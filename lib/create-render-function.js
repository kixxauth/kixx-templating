import LineSyntaxError from './line-syntax-error.js';

/* eslint-disable no-console */


/**
 * Create a render function from a list of tokens.
 *
 * @param {Object} options
 * @param {boolean} options.useVerboseLogging - Console.log errors and warnings.
 * @param {boolean} options.includeErrorMessages - Include the error message in the rendered output.
 * @param {Function} onerror - A function to call with the {error, lineError} object when an error occurs.
 * @param {Map} partials - A map of partial names to partial functions.
 * @param {Map} helpers - A map of helper names to helper functions.
 * @param {Array} tokens - An array of tokens.
 */
export default function createRenderFunction(options, onerror, partials, helpers, tokens) {
    if (typeof onerror !== 'function') {
        onerror = function () {};
    }

    const errors = [];

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
                case 'PATH_EXPRESSION':
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

    // Get a value by walking the JavaScript context object tree using
    // a path (already separated into parts as an Array)
    function dereferencePath(val, path, level = 0) {

        // If this is the last part of the path (leaf node), then return the value.
        if (level === path.length) {
            return val;
        }

        // Check for helpers by this name before checking the context. Helper names always
        // have a path length of 1 (they are not nested).
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
            value = '';

            const {
                line,
                lineNumber,
                startPosition,
                endPosition,
                filename,
            } = expressionToken.token;

            const lineError = new LineSyntaxError(`Unable to dereference path "${ arg.pathString }" in "${ filename }" on line ${ lineNumber }`, {
                filename,
                line,
                lineNumber,
                startPosition,
                endPosition,
            });

            if (options.useVerboseLogging) {
                console.error('');
                console.error(lineError.toString());
                console.error(`${ error.name }: ${ error.message }`);
            }
            if (options.includeErrorMessages) {
                value = lineError.message;
            }

            onerror({ error, lineError });
        }

        if (typeof value === 'function') {
            const helperName = arg.pathString;

            try {
                value = value(context);
            } catch (error) {
                value = '';

                const {
                    line,
                    lineNumber,
                    filename,
                } = expressionToken.token;

                const lineError = new LineSyntaxError(`Error in helper "${ helperName }" in "${ filename }" on line ${ lineNumber }`, {
                    filename,
                    line,
                    lineNumber,
                });

                if (options.useVerboseLogging) {
                    console.error('');
                    console.error(lineError.toString());
                    console.error(error.stack);
                }
                if (options.includeErrorMessages) {
                    value = lineError.message;
                }

                onerror({ error, lineError });
            }
        }

        if (typeof value === 'string') {
            return value;
        }

        if (typeof value === 'undefined' || value === null || isNaN(value)) {
            return '';
        }

        return value + ''; // eslint-disable-line no-implicit-coercion
    }

    function createScopedRenderer(parts) {

        return function renderContext(context) {
            let output = '';

            for (const part of parts) {
                switch (part.type) {
                    case 'CONTENT':
                        output += part.str;
                        break;
                    case 'EXPRESSION': {
                        output += safelyDereferencePath(part, part.exp, context);
                        break;
                    }
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
            const {
                line,
                lineNumber,
                startPosition,
                endPosition,
                filename,
            } = expressionToken.token;

            const err = new LineSyntaxError(`No helper named "${ helperName }" in "${ filename }" on line ${ lineNumber }`, {
                filename,
                line,
                lineNumber,
                startPosition,
                endPosition,
            });

            errors.push(err);

            return function renderContext() {
                if (options.includeErrorMessages) {
                    return err.message;
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

    // TODO: Lazily de-reference partials to prevent dependency ordering problems.
    // TODO: What is the block scoping available in a partial when we are in a loop?
    function createPartialRenderer(token) {
        const partialName = token.exp;

        if (partials.has(partialName)) {
            return partials.get(partialName);
        }

        const {
            line,
            lineNumber,
            startPosition,
            endPosition,
            filename,
        } = token.token;

        const err = new LineSyntaxError(`No partial named "${ partialName }" in "${ filename }" on line ${ lineNumber }`, {
            filename,
            line,
            lineNumber,
            startPosition,
            endPosition,
        });

        errors.push(err);

        return function renderContext() {
            if (options.includeErrorMessages) {
                return err.message;
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

                    const {
                        line,
                        lineNumber,
                        filename,
                    } = expressionToken.token;

                    const lineError = new LineSyntaxError(`Unable to dereference path "${ arg.pathString }" in "${ filename }" on line ${ lineNumber }`, {
                        filename,
                        line,
                        lineNumber,
                    });

                    if (options.useVerboseLogging) {
                        console.error('');
                        console.error(lineError.toString());
                        console.error(`${ error.name }: ${ error.message }`);
                    }
                    if (options.includeErrorMessages) {
                        errOut = lineError.message;
                    }

                    onerror({ error, lineError });

                    return errOut;
                }
            }

            const positionalArgs = positionalArguments.map(mapArgument);

            const namedArgs = Object.keys(namedArguments).reduce(function mapNamedArgument(hash, key) {
                hash[key] = mapArgument(namedArguments[key]);
                return hash;
            }, {});

            const helperUtils = {

                blockParams,

                renderPrimary(newContext) {
                    // The new context should be in the nearest scope closure, but the template
                    // still has access to values in upper scopes as long as those values are not
                    // shadowed (just like in JavaScript)
                    return renderPrimary(Object.assign({}, context, newContext));
                },

                renderInverse(newContext) {
                    // The new context should be in the nearest scope closure, but the template
                    // still has access to values in upper scopes as long as those values are not
                    // shadowed (just like in JavaScript)
                    return renderInverse(Object.assign({}, context, newContext));
                },
            };

            let output = '';

            try {
                output = helperFunction(helperUtils, context, namedArgs, ...positionalArgs);
            } catch (error) {
                output = '';

                const {
                    line,
                    lineNumber,
                    filename,
                } = expressionToken.token;

                const lineError = new LineSyntaxError(`Error in helper "${ helperName }" in "${ filename }" on line ${ lineNumber }`, {
                    line,
                    lineNumber,
                    filename,
                });

                if (options.useVerboseLogging) {
                    console.error('');
                    console.error(lineError.toString());
                    console.error(error.stack);
                }
                if (options.includeErrorMessages) {
                    output = lineError.message;
                }

                onerror({ error, lineError });
            }

            return output;
        };
    }

    const render = createRenderer(tokens);

    return { errors, render };
}
