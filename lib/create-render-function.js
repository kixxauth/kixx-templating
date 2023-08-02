import { EOL } from 'https://deno.land/std@0.196.0/fs/mod.ts';
import LineSyntaxError from './line-syntax-error.js';


export default function createRenderFunction(options, emitter, partials, helpers, tokens) {

    const errors = [];

    function dereferencePath(val, path, level = 0) {
        if (level === path.length) {
            return val;
        }

        if (path.length === 1 && helpers.has(path[0])) {
            return helpers.get(path[0]);
        }

        const key = path[level];
        return dereferencePath(val[key], path, level + 1);
    }

    function safelyDereferencePath(expressionToken, arg, context) {
        let value = '';

        try {
            value = dereferencePath(context, arg.path);
        } catch (error) {

            const lineError = new LineSyntaxError(`Unable to dereference path "${ arg.pathString }" on line ${ expressionToken.lineNumber }`, {
                line: expressionToken.line,
                lineNumber: expressionToken.lineNumber,
            });

            if (options.useVerboseLogging) {
                console.error(lineError.toString());
                console.error(`${ error.name }: ${ error.message }`);
            }
            if (options.includeErrorMessages) {
                value += (EOL + lineError.message + EOL);
            }

            emitter.emit('lineError', {
                error: lineError,
                line: expressionToken.line,
                lineNumber: expressionToken.lineNumber,
            });
        }

        if (typeof value === 'function') {
            const helperName = arg.pathString;
            try {
                value = value();
            } catch (error) {
                value = '';

                const lineError = new LineSyntaxError(`Error in helper "${ helperName }" on line ${ expressionToken.lineNumber }`, {
                    line: expressionToken.line,
                    lineNumber: expressionToken.lineNumber,
                });

                if (options.useVerboseLogging) {
                    console.error(lineError.toString());
                    console.error(`${ error.name }: ${ error.message }`);
                }
                if (options.includeErrorMessages) {
                    value += (EOL + lineError.message + EOL);
                    value += `${ error.name }: ${ error.message }${ EOL }`;
                }

                emitter.emit('lineError', {
                    error,
                    line: expressionToken.line,
                    lineNumber: expressionToken.lineNumber,
                });
            }
        }

        if (typeof value === 'string') {
            return value;
        }

        return value + ''; // eslint-disable-line no-implicit-coercion
    }

    function createRenderer(theseTokens) {
        const newTokenStream = [];

        for (const token of theseTokens) {
            switch (token.type) {
                case 'CONTENT':
                    if (newTokenStream.length > 0 && newTokenStream[newTokenStream.length - 1].type === 'CONTENT') {
                        // Combine content tokens whenever possible.
                        newTokenStream[newTokenStream.length - 1].str += token.str;
                    } else {
                        newTokenStream.push(token);
                    }
                    break;
                case 'EXPRESSION':
                    // Derefernce the exp[0] value now so that we do not need
                    // to do it in the renderer.
                    newTokenStream.push(Object.assign({}, token, { exp: token.exp[0] }));
                    break;
                case 'HELPER_EXPRESSION':
                case 'BLOCK_OPEN':
                    newTokenStream.push(Object.assign({}, token, {
                        type: 'HELPER_FUNCTION',
                        render: createHelperRenderer(token),
                    }));
                    break;
                case 'PARTIAL':
                    newTokenStream.push(Object.assign({}, token, {
                        type: 'PARTIAL_FUNCTION',
                        render: createPartialRenderer(token),
                    }));
                    break;
            }
        }

        return createScopedRenderer(newTokenStream);
    }

    function createScopedRenderer(parts) {
        console.log(parts);

        return function renderContext(context) {
            let output = '';

            for (const part of parts) {
                switch (part.type) {
                    case 'CONTENT':
                        output += part.str;
                        break;
                    case 'EXPRESSION':
                        output += safelyDereferencePath(part, part.exp, context);
                        break;
                    case 'HELPER_FUNCTION':
                    case 'PARTIAL_FUNCTION':
                        output += part.render(context);
                        break;
                }
            }

            return output;
        };
    }

    function createHelperRenderer(expressionToken) {
        const helperName = expressionToken.exp[0].path[0];
        const helperFunction = helpers.get(helperName);

        if (!helperFunction) {
            const err = new LineSyntaxError(`No helper named "${ helperName }" on line ${ expressionToken.lineNumber }`, {
                line: expressionToken.line,
                lineNumber: expressionToken.lineNumber,
                startPosition: expressionToken.startPosition,
                endPosition: expressionToken.endPosition,
            });

            errors.push(err);

            return function renderContext() {
                if (options.includeErrorMessages) {
                    return EOL + err.toString() + EOL;
                }
                return '';
            };
        }

        // Isolate the rest of the expression values.
        const rest = expressionToken.exp.slice(1);

        const positionalArguments = [];
        const namedArguments = {};
        let blockParams = [];

        for (const t of rest) {
            switch (t.type) {
                case 'PATH':
                case 'LITERAL':
                    positionalArguments.push(t);
                    break;
                case 'KEY_VALUE':
                    namedArguments[t.key] = t.value;
                    break;
                case 'BLOCK_PARAMS':
                    blockParams = t.params;
                    break;
            }
        }

        function noopRender() {
            return '';
        }

        let renderPrimary = noopRender;
        let renderInverse = noopRender;

        if (expressionToken.children && expressionToken.children.length > 0) {
            const renderTokens = [];
            // Inverse render tokens are used to create an inverse render function in
            // the if ... else ... scenario.
            const inverseRenderTokens = [];
            let inElse = false;

            for (const t of expressionToken.children) {
                if (inElse) {
                    inverseRenderTokens.push(t);
                } else if (t.type === 'ELSE') {
                    inElse = true;
                } else {
                    renderTokens.push(t);
                }
            }

            if (renderTokens.length > 0) {
                renderPrimary = createRenderer(renderTokens);
            }
            if (inverseRenderTokens.length > 0) {
                renderInverse = createRenderer(inverseRenderTokens);
            }
        }

        return createScopedHelperRenderer({
            expressionToken,
            positionalArguments,
            namedArguments,
            blockParams,
            helperName,
            helperFunction,
            renderPrimary,
            renderInverse,
        });
    }

    function createPartialRenderer(token) {
        const partialName = token.exp;

        if (partials.has(partialName)) {
            return partials.get(partialName);
        }

        const err = new LineSyntaxError(`No partial named "${ partialName }" on line ${ token.lineNumber }`, {
            line: token.line,
            lineNumber: token.lineNumber,
            startPosition: token.startPosition,
            endPosition: token.endPosition,
        });

        errors.push(err);

        return function renderContext() {
            if (options.includeErrorMessages) {
                return EOL + err.toString() + EOL;
            }
            return '';
        };
    }

    function createScopedHelperRenderer(args) {
        const {
            expressionToken,
            positionalArguments,
            namedArguments,
            blockParams,
            helperName,
            helperFunction,
            renderPrimary,
            renderInverse,
        } = args;

        return function renderHelper(context) {

            function mapArgument(arg) {
                if (arg.type === 'LITERAL') {
                    return arg.value;
                }

                try {
                    return dereferencePath(context, arg.path);
                } catch (error) {

                    let errOut = '';

                    const lineError = new LineSyntaxError(`Unable to dereference path "${ arg.pathString }" on line ${ expressionToken.lineNumber }`, {
                        line: expressionToken.line,
                        lineNumber: expressionToken.lineNumber,
                    });

                    if (options.useVerboseLogging) {
                        console.error(lineError.toString());
                        console.error(`${ error.name }: ${ error.message }`);
                    }
                    if (options.includeErrorMessages) {
                        errOut += (EOL + lineError.message + EOL);
                    }

                    emitter.emit('lineError', {
                        error: lineError,
                        line: expressionToken.line,
                        lineNumber: expressionToken.lineNumber,
                    });

                    return errOut;
                }
            }

            const positionalArgs = positionalArguments.map(mapArgument);

            const namedArgs = Object.keys(namedArguments).reduce(function mapNamedArgument(hash, key) {
                hash[key] = mapArgument(namedArguments[key]);
                return hash;
            }, {});

            const opts = {
                renderPrimary,
                renderInverse,
                blockParams,
            };

            let output = '';

            try {
                output = helperFunction(opts, ...positionalArgs, namedArgs);
            } catch (error) {
                const lineError = new LineSyntaxError(`Error in helper "${ helperName }" on line ${ expressionToken.lineNumber }`, {
                    line: expressionToken.line,
                    lineNumber: expressionToken.lineNumber,
                });

                if (options.useVerboseLogging) {
                    console.error(lineError.toString());
                    console.error(`${ error.name }: ${ error.message }`);
                }
                if (options.includeErrorMessages) {
                    output += (EOL + lineError.message + EOL);
                    output += `${ error.name }: ${ error.message }${ EOL }`;
                }

                emitter.emit('lineError', {
                    error,
                    line: expressionToken.line,
                    lineNumber: expressionToken.lineNumber,
                });
            }

            return output;
        };
    }

    const render = createRenderer(tokens);

    return { errors, render };
}