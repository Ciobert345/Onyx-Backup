const { isExcluded } = require('../src/utils/fileUtils');
const path = require('path');

const testCases = [
    // 1. Simple File Extension
    {
        path: 'C:\\Users\\User\\Downloads\\test.txt',
        exclusions: ['*.txt'],
        expected: true,
        desc: 'Extension *.txt should match test.txt'
    },
    {
        path: 'C:\\Users\\User\\Downloads\\image.png',
        exclusions: ['*.txt'],
        expected: false,
        desc: 'Extension *.txt should NOT match image.png'
    },

    // 2. Directory Name (Simple)
    {
        path: 'C:\\Users\\User\\Downloads\\node_modules\\package.json',
        exclusions: ['node_modules'],
        expected: true,
        desc: 'Directory node_modules should match content inside it'
    },
    {
        path: 'C:\\Users\\User\\Downloads\\src\\node_modules\\cache\\file.js',
        exclusions: ['node_modules'],
        expected: true,
        desc: 'Nested directory node_modules should match content inside it'
    },

    // 3. Glob Patterns
    {
        path: 'C:\\Users\\User\\Downloads\\temp\\cache.log',
        exclusions: ['temp/*'],
        expected: true,
        desc: 'Pattern temp/* should match files in temp'
    },

    // 4. Specific File
    {
        path: 'C:\\Users\\User\\Downloads\\secret.doc',
        exclusions: ['secret.doc'],
        expected: true,
        desc: 'Exact filename should match'
    },

    // 5. Mixed Path Styles
    {
        path: 'C:/Users/User/Downloads/test.log',
        exclusions: ['*.log'],
        expected: true,
        desc: 'Forward slash path should match *.log'
    }
];

console.log('Running Exclusion Tests...\n');

let failed = 0;

testCases.forEach((test, index) => {
    const result = isExcluded(test.path, test.exclusions);
    const passed = result === test.expected;

    if (!passed) {
        failed++;
        console.error(`❌ Test ${index + 1} Failed: ${test.desc}`);
        console.error(`   Path: ${test.path}`);
        console.error(`   Exclusions: ${JSON.stringify(test.exclusions)}`);
        console.error(`   Expected: ${test.expected}, Got: ${result}\n`);
    } else {
        console.log(`✅ Test ${index + 1} Passed: ${test.desc}`);
    }
});

if (failed === 0) {
    console.log('\n✨ All tests passed!');
} else {
    console.error(`\n⚠️ ${failed} tests failed.`);
    process.exit(1);
}
