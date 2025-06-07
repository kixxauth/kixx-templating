export default function tokenize(options, filename, utf8) {
    const lines = utf8.split('\n');
    const errors = [];
    const tokens = [];

    let lineIndex = 0;

    // Each line will break down as a new token, disregarding the "{{" "}}" syntax.
    for (; lineIndex < lines.length; lineIndex += 1) {
        // Add the newline character back after splitting it out.
        const line = lines[lineIndex] + '\n';

        let startPosition = 0;
        let tokenString = '';

        let position = 0;

        for (; position < line.length; position += 1) {
            const char = line[position];

            if (char === '{') {
                if (tokenString.endsWith('{')) {
                    tokens.push({
                        filename,
                        lineNumber: lineIndex + 1,
                        startPosition,
                        // The end position of the previous token is now 2 places backward.
                        endPosition: position - 2,
                        // Pop off the "{" char, which indicated we are ready to enter a
                        // mustache, and throw it away.
                        tokenString: tokenString.slice(0, -1),
                        line,
                    });

                    // The new token string is a mustache.
                    tokenString = '{{';
                    startPosition = position - 1;
                } else {
                    tokenString += char;
                }
            } else if (char === '}') {
                if (tokenString.endsWith('}')) {
                    tokens.push({
                        filename,
                        lineNumber: lineIndex + 1,
                        startPosition,
                        // The end position of the previous token is now 2 places backward.
                        endPosition: position - 2,
                        // Pop off the "}" char, which indicated we are ready to enter a
                        // mustache, and throw it away.
                        tokenString: tokenString.slice(0, -1),
                        line,
                    });

                    // The new token string is a mustache.
                    tokenString = '}}';
                    startPosition = position - 1;
                } else {
                    tokenString += char;
                }
            } else if (tokenString === '{{' || tokenString === '}}') {
                tokens.push({
                    filename,
                    lineNumber: lineIndex + 1,
                    startPosition,
                    endPosition: position - 1,
                    tokenString,
                    line,
                });

                startPosition = position;
                tokenString = char;
            } else {
                tokenString += char;
            }
        }

        tokens.push({
            filename,
            lineNumber: lineIndex + 1,
            startPosition,
            endPosition: position - 1,
            tokenString,
            line,
        });
    }

    return { tokens, errors };
}
