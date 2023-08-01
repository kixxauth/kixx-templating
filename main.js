/* globals Deno */

class LineSyntaxError extends Error {

    constructor(message, spec) {
        super(message);

        Object.defineProperties(this, {
            name: {
                enumerable: true,
                value: 'LineSyntaxError',
            },
            message: {
                enumerable: true,
                value: message,
            },
            line: {
                enumerable: true,
                value: spec.line,
            },
            lineNumber: {
                enumerable: true,
                value: spec.lineNumber,
            },
            startPosition: {
                enumerable: true,
                value: spec.startPosition,
            },
            endPosition: {
                enumerable: true,
                value: spec.endPosition,
            },
        });
    }

    toString() {
        let lines;

        if (Number.isInteger(this.startPosition)) {
            let linePointer = '';
            const linePointerLength = this.lineNumber.toString().length + 2 + this.startPosition;

            for (let i = 0; i < linePointerLength; i += 1) {
                linePointer += ' ';
            }

            linePointer += '^';

            lines = [
                `${ this.name }: ${ this.message }`,
                `${ this.lineNumber }: ${ this.line.trimEnd() }`,
                linePointer,
                '',
            ];
        } else {
            lines = [
                `${ this.name }: ${ this.message }`,
                `${ this.lineNumber }: ${ this.line.trimEnd() }`,
                '',
            ];
        }

        return lines.join('\n');
    }
}

function tokenize(utf8) {
    const lines = utf8.split('\n');
    const errors = [];
    const tokens = [];

    let lineIndex = 0;

    for (; lineIndex < lines.length; lineIndex += 1) {
        // Add the newline character back after splitting it out.
        const line = lines[lineIndex] + '\n';

        let startPosition = 0;
        let tokenString = '';

        let position = 0;

        for (; position < line.length; position += 1) {
            const char = line[position];

            if (char === '{') {
                if (tokenString === '{{') {
                    // This is a non-escaped HTML string value.
                    tokens.push({
                        line,
                        lineNumber: lineIndex + 1,
                        startPosition,
                        endPosition: position,
                        tokenString: '{{{',
                    });

                    tokenString = '';
                    startPosition = position + 1;
                } else if (tokenString.endsWith('{')) {
                    // Pop off the "{" char, which indicated we are ready to enter a mustache, and
                    // throw it away.
                    tokenString = tokenString.slice(0, -1);

                    tokens.push({
                        line,
                        lineNumber: lineIndex + 1,
                        startPosition,
                        // The end position of the previous token is now 2 places backward.
                        endPosition: position - 2,
                        tokenString,
                    });

                    // The new token string is a mustache.
                    tokenString = '{{';
                    startPosition = position - 1;
                } else {
                    tokenString += char;
                }
            } else if (char === '}') {
                if (tokenString === '}}') {
                    // This is a non-escaped HTML string value.
                    tokens.push({
                        line,
                        lineNumber: lineIndex + 1,
                        startPosition,
                        endPosition: position,
                        tokenString: '}}}',
                    });

                    startPosition = position + 1;
                    tokenString = '';
                } else if (tokenString.endsWith('}')) {
                    // Pop off the "}" char, which indicated we are ready to enter a mustache, and
                    // throw it away.
                    tokenString = tokenString.slice(0, -1);

                    tokens.push({
                        line,
                        lineNumber: lineIndex + 1,
                        startPosition,
                        // The end position of the previous token is now 2 places backward.
                        endPosition: position - 2,
                        tokenString,
                    });

                    // The new token string is a mustache.
                    tokenString = '}}';
                    startPosition = position - 1;
                } else {
                    tokenString += char;
                }
            } else if (tokenString === '{{' || tokenString === '}}') {
                tokens.push({
                    line,
                    lineNumber: lineIndex + 1,
                    startPosition,
                    endPosition: position - 1,
                    tokenString,
                });

                startPosition = position;
                tokenString = char;
            } else {
                tokenString += char;
            }
        }

        tokens.push({
            line,
            lineNumber: lineIndex + 1,
            startPosition,
            endPosition: position - 1,
            tokenString,
        });
    }

    return { tokens, errors };
}

function buildSyntaxTree(tokens) {
    const errors = [];
    const tree = [];
    const blocks = [];

    let previousToken = null;
    let currentLine = 0;
    let mustacheOpenToken = null;
    let expectingExpression = false;
    let expectingMustacheClose = false;

    // Check to see if the current token represents a new line of source code.
    // If so, then update the current line number and return true.
    // This is useful for catching syntax errors (ex: no closing mustache before reaching
    // the end of a line) and reporting on syntax errors with the line number for reference.
    function resetLineNumber(newLineNumber) {
        if (currentLine !== newLineNumber) {
            currentLine = newLineNumber;
            return true;
        }

        return false;
    }

    // Make some reasonable guesses about the node type, then push it onto the AST.
    function pushNode(node) {
        if (node.type === 'EXPRESSION' && node.exp.length > 1) {
            // If a node has more than one sub expression, we can assume it
            // is a helper expression.
            node.type = 'HELPER_EXPRESSION';
        }
        if (node.type === 'EXPRESSION' && node.exp.length === 1) {
            const exp = node.exp[0];
            // eslint-disable-next-line no-useless-escape
            if (exp.type === 'PATH' && /[\.\[\]]+/.test(exp.path)) {
                // If a path has dereferencing characters in it ([,.,]) then we can assume it
                // is a path expression.
                node.type = 'PATH_EXPRESSION';
            }
        }

        // If we are in a sub block then push the node onto the current branch of the AST.
        if (blocks.length > 0) {
            blocks[blocks.length - 1].children.push(node);
        } else {
            tree.push(node);
        }
    }

    // Special handler for nested block openers.
    function pushBlockOpen(node) {
        if (blocks.length > 0) {
            blocks[blocks.length - 1].children.push(node);
        } else {
            tree.push(node);
        }

        blocks.push(node);
    }

    // Special handler for nested block closers.
    function pushBlockClose() {
        blocks.pop();
    }

    // Called with an expression token (the token between {{ }} mustaches).
    function addExpression(token) {
        const tokenString = token.tokenString.trim();
        const encodeMarkup = mustacheOpenToken.tokenString === '{{';

        // Some expressions are explicitly typed using the first character.
        switch (tokenString[0]) {
            case '#': // Open Block Helper
                pushBlockOpen({
                    type: 'BLOCK_OPEN',
                    exp: parseExpression(token, tokenString.slice(1).trim()),
                    children: [],
                    token,
                });
                break;
            case '/': // Close Block Helper
                pushBlockClose({
                    type: 'BLOCK_CLOSE',
                    exp: tokenString.slice(1).trim(),
                    token,
                });
                break;
            case '>': // Partial
                pushNode({
                    type: 'PARTIAL',
                    exp: tokenString.slice(1).trim(),
                    token,
                });
                break;
            default:
                // Handle expressions which do not have an explicit type using the first character.
                if (tokenString === 'else') {
                    pushNode({ type: 'ELSE', token });
                } else {
                    pushNode({
                        type: 'EXPRESSION',
                        exp: parseExpression(token, tokenString),
                        encodeMarkup,
                        token,
                    });
                }
        }
    }

    // Push a simple content node onto the current branch of the AST.
    function addContent(token) {
        pushNode({
            type: 'CONTENT',
            str: token.tokenString,
            token,
        });
    }

    function parseReferencePath(token, str) {
        const parts = [];
        let currentToken = '';
        let inBracket = false;

        for (const c of str) {
            if (c === '.') {
                if (inBracket) {
                    errors.push(new LineSyntaxError(`Invalid "." after "[" in path expression on line ${ token.lineNumber }`, {
                        line: token.line,
                        lineNumber: token.lineNumber,
                    }));
                } else if (currentToken) {
                    parts.push(currentToken);
                    currentToken = '';
                }
            } else if (c === '[') {
                if (inBracket) {
                    errors.push(new LineSyntaxError(`Invalid "[" after "[" in path expression on line ${ token.lineNumber }`, {
                        line: token.line,
                        lineNumber: token.lineNumber,
                    }));
                } else {
                    inBracket = true;
                    if (currentToken) {
                        parts.push(currentToken);
                        currentToken = '';
                    }
                }
            } else if (c === ']') {
                if (inBracket) {
                    inBracket = false;

                    const n = Number.parseInt(currentToken, 10);

                    if (Number.isNaN(n)) {
                        parts.push(currentToken);
                    } else {
                        parts.push(n);
                    }
                    currentToken = '';
                } else {
                    errors.push(new LineSyntaxError(`Invalid closing "]" in path expression on line ${ token.lineNumber }`, {
                        line: token.line,
                        lineNumber: token.lineNumber,
                    }));
                }

            } else if (inBracket) {
                // Almost any character is allowed in a bracket, except "." and "[]".
                currentToken += c;
            } else if (/\w/.test(c)) {
                // Only word characters are allowed outside of a bracket.
                currentToken += c;
            } else {
                errors.push(new LineSyntaxError(`Invalid JavaScript symbol character "${ c }" in path expression on line ${ token.lineNumber }`, {
                    line: token.line,
                    lineNumber: token.lineNumber,
                }));
            }
        }

        parts.push(currentToken);

        return parts;
    }

    // Parse an expression token (the token between {{ }} mustaches).
    function parseExpression(token, str) {
        const expTokens = [];
        let subToken = null;
        let expTokenString = '';
        let inStringLiteral = false;
        let inBlockParams = false;

        // Parse a sub-token of the expression token, looking for JavaScript literals.
        // Otherwise, return the value as a JavaScript path reference.
        function parseJavaScriptType() {
            const rv = { type: 'LITERAL', value: expTokenString };
            let n;

            if (inStringLiteral) {
                return rv;
            }

            switch (expTokenString) {
                case 'true':
                    rv.value = true;
                    return rv;
                case 'false':
                    rv.value = false;
                    return rv;
                case 'null':
                    rv.value = null;
                    return rv;
                case 'undefined':
                    // eslint-disable-next-line no-undefined
                    rv.value = undefined;
                    return rv;
                default:
                    n = Number.parseInt(expTokenString, 10);
                    if (Number.isNaN(n)) {
                        n = Number.parseFloat(expTokenString);
                    }

                    if (Number.isNaN(n)) {
                        rv.type = 'PATH';
                        rv.path = parseReferencePath(token, expTokenString);
                    } else {
                        rv.value = n;
                    }

                    return rv;
            }
        }

        // Close the current sub token and move onto the next.
        function closeSubToken() {
            const value = parseJavaScriptType();

            if (subToken && subToken.type === 'KEY_VALUE') {
                subToken.value = value;
            } else if (value.type === 'PATH') {
                subToken = {
                    type: 'PATH',
                    path: value.path,
                };
            } else {
                subToken = {
                    type: 'LITERAL',
                    value: value.value,
                };
            }

            expTokens.push(subToken);
            expTokenString = '';
            subToken = null;
        }

        for (const c of str) {
            if (inBlockParams) {
                if (c === '|') {
                    expTokens.push({
                        type: 'BLOCK_PARAMS',
                        // Split the params on a space " " after removing extra whitespace.
                        params: expTokenString.trim().replace(/[\s]+/g, ' ').split(' '),
                    });

                    expTokenString = '';
                    inBlockParams = false;
                } else {
                    expTokenString += c;
                }
            } else if (inStringLiteral) {
                if (c === '"') {
                    closeSubToken();
                    inStringLiteral = false;
                } else {
                    expTokenString += c;
                }
            } else if (c === '"') {
                inStringLiteral = true;
            } else if (c === '=') {
                subToken = {
                    type: 'KEY_VALUE',
                    key: expTokenString,
                };

                expTokenString = '';
            } else if (/\s/.test(c)) {
                if (expTokenString) {
                    closeSubToken();
                }
            } else if (c === '|') {
                subToken = expTokens[expTokens.length - 1];

                if (subToken && subToken.type === 'PATH' && subToken.path[0] === 'as') {
                    inBlockParams = true;
                    expTokens.pop();
                    subToken = null;
                    expTokenString = '';
                }
            } else {
                expTokenString += c;
            }
        }

        if (inBlockParams) {
            errors.push(new LineSyntaxError(`Unclosed block params on line ${ previousToken.lineNumber }`, {
                line: token.line,
                lineNumber: token.lineNumber,
                startPosition: token.startPosition,
                endPosition: token.endPosition,
            }));
        } else if (expTokenString) {
            closeSubToken();
        }

        return expTokens;
    }

    function isClosingMustache(token) {
        return token.tokenString === '}}' || token.tokenString === '}}}';
    }

    function isOpeningMustache(token) {
        return token.tokenString === '{{' || token.tokenString === '{{{';
    }

    for (const token of tokens) {
        if (resetLineNumber(token.line) && mustacheOpenToken) {
            errors.push(new LineSyntaxError(`Unclosed mustache on line ${ previousToken.lineNumber }`, {
                line: previousToken.line,
                lineNumber: previousToken.lineNumber,
                startPosition: mustacheOpenToken.startPosition,
                endPosition: mustacheOpenToken.endPosition,
            }));

            mustacheOpenToken = null;
            expectingMustacheClose = false;
            expectingExpression = false;
        }

        if (expectingMustacheClose && !isClosingMustache(token)) {
            errors.push(new LineSyntaxError(`Expected closing mustache but got ${ token.tokenString } on line ${ token.lineNumber }`, {
                line: token.line,
                lineNumber: token.lineNumber,
                startPosition: token.startPosition,
                endPosition: token.endPosition,
            }));
            expectingMustacheClose = false;
        } else if (isClosingMustache(token)) {
            mustacheOpenToken = null;
            expectingExpression = false;
            expectingMustacheClose = false;
        } else if (isOpeningMustache(token)) {
            if (expectingExpression) {
                errors.push(new LineSyntaxError(`Expected expression but got ${ token.tokenString } on line ${ token.lineNumber }`, {
                    line: token.line,
                    lineNumber: token.lineNumber,
                    startPosition: token.startPosition,
                    endPosition: token.endPosition,
                }));
            } else {
                mustacheOpenToken = token;
                expectingExpression = true;
            }
        } else if (expectingExpression) {
            addExpression(token);
            expectingExpression = false;
            expectingMustacheClose = true;
        } else {
            addContent(token);
        }

        previousToken = token;
    }

    return { tree, errors };
}

// Used for scope testing below
const baz = 3; // eslint-disable-line no-unused-vars

function createFunction() {

    /* eslint-disable */
    const body = [
        'const parts = [];',
        'function push(s) { parts.push(s); }',
        'with (data) {',
        // Will be "object" unless there is a `console` member on the data object.
        'push(`typeof console: ${typeof console}`);',
        // Will be undefined
        'push(`typeof this.console: ${typeof this.console}`);',
        // Will be number
        'push(`typeof foo: ${typeof foo}`);',
        // Will be undefined; not on the data object.
        'push(`typeof bar: ${typeof bar}`);',
        // Will be undefined; cannot access module values.
        'push(`typeof baz: ${typeof baz}`);',
        // Will be string; getting this off the data object.
        'push(`typeof foobar: ${typeof foobar}`);',
        // Will be undefined; not available on the context.
        'push(`typeof this.foo: ${typeof this.foo}`);',
        // Will be number; is defined on the context
        'push(`typeof this.bar: ${typeof this.bar}`);',
        // Will be undefined; cannot access module values.
        'push(`typeof this.baz: ${typeof this.baz}`);',
        // Will be number; defined on the context.
        'push(`typeof this.foobar: ${typeof this.foobar}`);',
        '}',
        'return parts.join("\\n");',
    ].join('\n');

    return new Function('data', body);
    /* eslint-enable */
}

// eslint-disable-next-line no-unused-vars
function main_testFunctionScope() {
    const data = { foo: 1, console: 'foo', foobar: 'three' };
    const context = { bar: 2, foobar: 3 };

    const fn = createFunction().bind(context);

    console.log(fn(data));
}

async function main() {
    const utf8 = await Deno.readTextFile('./example.html');
    const { tokens } = tokenize(utf8);

    // Uncomment to view raw tokens
    // tokens.forEach((item) => {
    //     console.log(item);
    // });

    // Uncomment to save the AST as JSON.
    const { tree, errors } = buildSyntaxTree(tokens);

    errors.forEach((err) => {
        console.log(err.toString());
    });

    await Deno.writeTextFile('./ast.json', JSON.stringify(tree, null, 2));
}

main();
