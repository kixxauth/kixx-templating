/* global Deno */
import KixxTemplating from '../main.js';


async function main() {
    let res;
    const utf8String = await Deno.readTextFile('./example/example.html');

    res = KixxTemplating.tokenize({}, utf8String);

    if (res.errors && res.errors.length > 0) {
        throw res.errors[0];
    }

    res = KixxTemplating.buildSyntaxTree({}, res.tokens);

    if (res.errors && res.errors.length > 0) {
        throw res.errors[0];
    }

    await Deno.writeTextFile('./example/ast.json', JSON.stringify(res.tree, null, 2));
}

main().catch(function catchError(err) {
    console.error(err.stack); // eslint-disable-line no-console
});
