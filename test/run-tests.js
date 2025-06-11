import expectedErrorCases from './expected-error-cases.js';

expectedErrorCases.forEach((testCase) => {
    testCase();
});

// eslint-disable-next-line no-console
console.log('All tests passed');
