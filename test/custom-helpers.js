
export function resolve(context, options, val, defaultVal) {
    if (val || val === false || val === 0) {
        // eslint-disable-next-line no-implicit-coercion
        return '' + val;
    }

    return defaultVal;
}

export function image(context, opts, ...positionals) {
    const srcset = positionals.filter((x) => Boolean(x)).join(', ');
    return `<img src="${ positionals[0] }" srcset="${ srcset }">`;
}

export function format_date(context, opts, dateString) {
    const { format } = opts;
    const isoString = new Date(dateString).toISOString();
    return `${ isoString.split('T')[0] } format=${ format }`;
}
