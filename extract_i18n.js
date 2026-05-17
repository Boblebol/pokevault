const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'web', 'i18n.js'), 'utf-8');

// Use a simple regex to find the messages object. 
// Since it's a constant in a self-invoking function, we can try to evaluate it if needed,
// but regex is safer for simple JSON-like structures.
const match = content.match(/const messages = ({[\s\S]*?});/);

if (match) {
    // We need to handle the fact that it might have trailing commas or non-JSON syntax
    // but the current i18n.js looks like valid JS object literal which is close to JSON.
    // A trick is to use eval() on the string to get the object and then stringify to JSON.
    const messages = eval(`(${match[1]})`);
    fs.writeFileSync(path.join(__dirname, 'data', 'i18n.json'), JSON.stringify(messages, null, 2));
    console.log('Extracted i18n to data/i18n.json');
} else {
    console.error('Could not find messages in i18n.js');
    process.exit(1);
}
