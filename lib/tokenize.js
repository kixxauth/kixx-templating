export default function tokenize(options, utf8) {
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
