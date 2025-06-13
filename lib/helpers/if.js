/* eslint-disable no-invalid-this */

export function if_helper(context, options, val) {
    if (val) {
        return this.renderPrimary();
    }
    return this.renderInverse(context);
}
