import javascriptGenerator from '../javascriptGenerator';
import registerBlock from '../register';

import Precompile from '../compiler/precompile';

const categoryPrefix = 'conditions_';
const categoryColor = '#ffb900';
let repeatDelayTime = 1000 / 60; // how much time before the next iteration in a loop

const repeatCondDelayIfEnabled = () => {
    if (!Precompile.forceConditionalPauses) return '';
    repeatDelayTime = 1000 / Precompile.targetFPS;
    return `await new Promise(resolve => setTimeout(() => resolve(), ${repeatDelayTime}));`;
};

function register() {
    // if <> then {}
    registerBlock(`${categoryPrefix}ifthen`, {
        message0: 'if %1 then %2 %3',
        args0: [
            {
                "type": "input_value",
                "name": "CONDITION",
                "check": "Boolean"
            },
            {
                "type": "input_dummy"
            },
            {
                "type": "input_statement",
                "name": "BLOCKS"
            }
        ],
        previousStatement: null,
        nextStatement: null,
        inputsInline: true,
        colour: categoryColor
    }, (block) => {
        const CONDITION = javascriptGenerator.valueToCode(block, 'CONDITION', javascriptGenerator.ORDER_ATOMIC);
        const BLOCKS = javascriptGenerator.statementToCode(block, 'BLOCKS');
        const code = `if (${CONDITION ? CONDITION : 'false'}) { ${BLOCKS} };`;
        return `${code}\n`;
    })
    // if <> then {} else {}
    registerBlock(`${categoryPrefix}ifthenelse`, {
        message0: 'if %1 then %2 %3 else %4 %5',
        args0: [
            {
                "type": "input_value",
                "name": "CONDITION",
                "check": "Boolean"
            },
            {
                "type": "input_dummy"
            },
            {
                "type": "input_statement",
                "name": "BLOCKS"
            },
            {
                "type": "input_dummy"
            },
            {
                "type": "input_statement",
                "name": "BLOCKS2"
            }
        ],
        previousStatement: null,
        nextStatement: null,
        inputsInline: true,
        colour: categoryColor
    }, (block) => {
        const CONDITION = javascriptGenerator.valueToCode(block, 'CONDITION', javascriptGenerator.ORDER_ATOMIC);
        const BLOCKS = javascriptGenerator.statementToCode(block, 'BLOCKS');
        const BLOCKS2 = javascriptGenerator.statementToCode(block, 'BLOCKS2');
        const code = `if (${CONDITION ? CONDITION : 'false'}) { ${BLOCKS} } else { ${BLOCKS2} };`;
        return `${code}\n`;
    })
    registerBlock(`${categoryPrefix}ifthenreturn`, {
        message0: 'if %1 then %2 else %3',
        args0: [
            {
                "type": "input_value",
                "name": "CONDITION",
                "check": "Boolean"
            },
            {
                "type": "field_input",
                "name": "X",
                "check": null,
                "text": "Hello",
                "acceptsBlocks": true
            },
            {
                "type": "field_input",
                "name": "Y",
                "check": null,
                "text": "World",
                "acceptsBlocks": true
            },
        ],
        output: null,
        inputsInline: false,
        colour: categoryColor
    }, (block) => {
        const CONDITION = javascriptGenerator.valueToCode(block, 'CONDITION', javascriptGenerator.ORDER_ATOMIC);
        const X = javascriptGenerator.valueToCode(block, 'X', javascriptGenerator.ORDER_ATOMIC);
        const Y = javascriptGenerator.valueToCode(block, 'Y', javascriptGenerator.ORDER_ATOMIC);
        return [`(${CONDITION || false} ? ${X} : ${Y})`, javascriptGenerator.ORDER_NONE];
    })
    // wait until <>
    registerBlock(`${categoryPrefix}waituntil`, {
        message0: 'wait until %1',
        args0: [
            {
                "type": "input_value",
                "name": "CONDITION",
                "check": "Boolean"
            }
        ],
        previousStatement: null,
        nextStatement: null,
        inputsInline: true,
        colour: categoryColor
    }, (block) => {
        const CONDITION = javascriptGenerator.valueToCode(block, 'CONDITION', javascriptGenerator.ORDER_ATOMIC);
        const code = `while ((!(${CONDITION ? CONDITION : 'false'})) && !character.disposed) { ${repeatCondDelayIfEnabled()} };`;
        return `${code}\n`;
    })
}

export default register;
