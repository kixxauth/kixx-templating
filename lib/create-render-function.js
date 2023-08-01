import { EOL } from 'https://deno.land/std@0.196.0/fs/mod.ts';
import LineSyntaxError from './line-syntax-error.js';


export default function createRenderFunction(options, emitter, helpers) {

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

    function createScopedRenderer(parts) {

        return function render(context) {
            let output = '';

            for (const part of parts) {
                switch (part.type) {
                    case 'CONTENT':
                        output += part.str;
                        break;
                    case 'EXPRESSION':
                        output += safelyDereferencePath(part, part.exp[0], context);
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

    /*
    function createBlockFunction(token) {
        const helperName = token.exp[0].path[0];
        const helper = helpers.get(helperName);

        if (!helper) {
            errors.push(new LineSyntaxError(`No helper named "${ helperName }" on line ${ token.lineNumber }`, {
                line: token.line,
                lineNumber: token.lineNumber,
                startPosition: token.startPosition,
                endPosition: token.endPosition,
            }));

            return null;
        }

        // Isolate the rest of the expression values.
        const rest = token.exp.slice(1);

        const positionals = [];
        const options = {};
        let blockParams = null;

        for (const t of rest) {
            switch (t.type) {
                case 'PATH':
                case 'LITERAL':
                    positionals.push(t);
                    break;
                case 'KEY_VALUE':
                    options[t.key] = t.value;
                    break;
                case 'BLOCK_PARAMS':
                    blockParams = t.params;
                    break;
            }
        }

        const renderTokens = [];
        // Inverse render tokens are used to create an inverse render function in
        // the if ... else ... scenario.
        const inverseRenderTokens = [];
        let inElse = false;

        for (const t of token.children) {
            if (inElse) {
                inverseRenderTokens.push(t);
            } else if (t.type === 'ELSE') {
                inElse = true;
            } else {
                renderTokens.push(t);
            }
        }

        const renderFunction = createRenderFunction(renderTokens);

        const inverseRenderFunction = inverseRenderTokens.length > 0
            ? createRenderFunction(inverseRenderTokens)
            : null;
    }
    */

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
}
