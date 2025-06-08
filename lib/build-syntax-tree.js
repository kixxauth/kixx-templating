import LineSyntaxError from './line-syntax-error.js';


export default function buildSyntaxTree(options, tokens) {
    const tree = [];
    const blocks = [];

    let mustacheOpenToken = null;
    let commentOpenToken = null;
    let expressionParts = [];

    for (const token of tokens) {
        if (token.tokenString === '{{') {
            if (mustacheOpenToken) {
                throw new LineSyntaxError(`Failed to close mustache from line ${ mustacheOpenToken.lineNumber }`, mustacheOpenToken);
            } else {
                mustacheOpenToken = token;
            }
        } else if (token.tokenString === '{{!--') {
            if (commentOpenToken) {
                throw new LineSyntaxError(`Failed to close comment from line ${ commentOpenToken.lineNumber }`, commentOpenToken);
            } else {
                commentOpenToken = token;
            }
        } else if (mustacheOpenToken && token.tokenString === '}}') {
            addExpression(expressionParts, mustacheOpenToken);
            expressionParts = [];
            mustacheOpenToken = null;
        } else if (commentOpenToken && token.tokenString === '--}}') {
            commentOpenToken = null;
        } else if (mustacheOpenToken) {
            expressionParts.push(token);
        } else {
            pushNode({
                type: 'CONTENT',
                str: token.tokenString,
                tokens: [ token ],
            });
        }
    }

    if (mustacheOpenToken) {
        throw new LineSyntaxError(`Failed to close mustache from line ${ mustacheOpenToken.lineNumber }`, mustacheOpenToken);
    }
    if (commentOpenToken) {
        throw new LineSyntaxError(`Failed to close comment from line ${ commentOpenToken.lineNumber }`, commentOpenToken);
    }
    if (blocks.length > 0) {
        const token = blocks[0].tokens[0];
        throw new LineSyntaxError(`Failed to close block from line ${ token.lineNumber }`, token);
    }

    // Called with an expression token (the tokens between {{ }} mustaches).
    function addExpression(_tokens) {
        const tokenString = _tokens.map((t) => t.tokenString).join(' ').trim();

        // Some expressions are explicitly typed using the first few characters.
        if (tokenString.startsWith('#')) {
            pushBlockOpen({
                type: 'BLOCK_OPEN',
                exp: parseExpression(_tokens, tokenString.slice(1).trim()),
                children: [],
                tokens: _tokens,
            });
        } else if (tokenString.startsWith('/')) {
            pushBlockClose({
                type: 'BLOCK_CLOSE',
                exp: tokenString.slice(1).trim(),
                tokens: _tokens,
            });
        } else if (tokenString.startsWith('>')) {
            pushNode({
                type: 'PARTIAL',
                exp: tokenString.slice(1).trim(),
                tokens: _tokens,
            });
        } else if (tokenString === 'else') {
            pushNode({ type: 'ELSE', tokens: _tokens });
        } else {
            pushNode(createExpressionNode(_tokens, tokenString));
        }
    }

    function createExpressionNode(_tokens, tokenString) {
        const exp = parseExpression(_tokens, tokenString);

        // An expression length less than 1 would indicate an
        // empty mustache like this: "{{ }}". We just igore it.
        const type = exp.length <= 1 ? 'PATH_EXPRESSION' : 'HELPER_EXPRESSION';

        return {
            type,
            exp,
            tokens: _tokens,
        };
    }

    // Parse an expression token (the token between {{ }} mustaches).
    function parseExpression(_tokens, str) {
        const expTokens = [];
        let subToken = null;
        let expTokenString = '';
        let inStringLiteral = false;
        let inBlockParams = false;

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
                if (c === inStringLiteral) {
                    closeSubToken();
                    inStringLiteral = false;
                } else {
                    expTokenString += c;
                }
            } else if (c === '"' || c === "'") {
                inStringLiteral = c;
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
            const lastToken = _tokens[_tokens.length - 1];
            throw new LineSyntaxError(`Unclosed block params on line ${ lastToken.lineNumber }`, lastToken);
        } else if (expTokenString) {
            closeSubToken();
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
                    pathString: value.pathString,
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

        // Parse a sub-token of the expression token, looking for JavaScript literals.
        // Otherwise, return the value as a JavaScript path reference.
        function parseJavaScriptType() {
            const rv = { type: 'LITERAL' };
            let n;

            if (inStringLiteral) {
                rv.value = expTokenString;
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
                    rv.value = undefined;
                    return rv;
                default:
                    // Since we already detected string literals above (with inStringLiteral) then
                    // we are only worried about differentiating between numbers and paths here.
                    n = Number.parseFloat(expTokenString);

                    if (Number.isNaN(n)) {
                        rv.type = 'PATH';
                        rv.path = parseReferencePath(_tokens, expTokenString);
                        rv.pathString = expTokenString;
                    } else {
                        rv.value = n;
                    }

                    return rv;
            }
        }

        return expTokens;
    }

    function parseReferencePath(_tokens, str) {
        const parts = [];
        let currentToken = '';
        let inBracket = false;

        for (const c of str) {
            if (c === '.') {
                if (inBracket) {
                    const lastToken = _tokens[_tokens.length - 1];
                    throw new LineSyntaxError(`Invalid "." after "[" in path expression on line ${ lastToken.lineNumber }`, lastToken);
                } else if (currentToken) {
                    parts.push(currentToken);
                    currentToken = '';
                }
            } else if (c === '[') {
                if (inBracket) {
                    const lastToken = _tokens[_tokens.length - 1];
                    throw new LineSyntaxError(`Invalid "[" after "[" in path expression on line ${ lastToken.lineNumber }`, lastToken);
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
                    const lastToken = _tokens[_tokens.length - 1];
                    throw new LineSyntaxError(`Invalid closing "]" in path expression on line ${ lastToken.lineNumber }`, lastToken);
                }

            } else if (inBracket) {
                // Almost any character is allowed in a bracket, except "." and "[]".
                currentToken += c;
            } else if (/\w/.test(c)) {
                // Only word characters are allowed outside of a bracket.
                currentToken += c;
            } else {
                const lastToken = _tokens[_tokens.length - 1];
                throw new LineSyntaxError(`Invalid JavaScript symbol character "${ c }" in path expression on line ${ lastToken.lineNumber }`, lastToken);
            }
        }

        parts.push(currentToken);

        return parts;
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

    function pushNode(node) {

        // If we are in a sub block then push the node onto the current branch of the AST.
        if (blocks.length > 0) {
            blocks[blocks.length - 1].children.push(node);
        } else {
            tree.push(node);
        }
    }

    return tree;
}
