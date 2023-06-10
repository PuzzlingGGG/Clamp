import javascriptGenerator from '../javascriptGenerator';
import ProjectState from '../state';

class Compiler {
    constructor() {
        this.characters = ProjectState.default.characters;
        this.images = ProjectState.default.images;
        this.sounds = ProjectState.default.sounds;
    }

    /**
     * Used internally.
     * @param {Array} array 
     */
    setCharacters(array) {
        this.characters = array;
    }
    /**
     * Used internally.
     * @param {Array} array 
     */
    setImages(array) {
        this.images = array;
    }
    /**
     * Used internally.
     * @param {Array} array 
     */
    setSounds(array) {
        this.sounds = array;
    }

    /**
     * Generates JavaScript code from each character's workspace, images and sounds.
     * This code can then be ran inside the GamePlayer component, or stand-alone in the future.
     */
    compile() {
        // set characters & others to the current project state
        this.setCharacters(ProjectState.currentProject.characters);
        this.setImages(ProjectState.currentProject.images);
        this.setSounds(ProjectState.currentProject.sounds);

        // get JS code from each character's workspace, then add in some general setup stuff
        // to make sure character specific blocks work like {go to x: () y: ()}
        const genCode = [];
        for (const character of this.characters) {
            // if no workspace set, dont do the thingy
            if (!character.workspace) continue;

            const characterIdentifier = JSON.stringify(character.id);
            // we can push an array & just flatten genCode later because funny
            genCode.push([
                `// Character ${characterIdentifier}`,
                `characterFunctions[${characterIdentifier}] = (character) => { // characterFunctions is defined in setupCode`,
                javascriptGenerator.workspaceToCode(character.workspace),
                `}`
            ])
        }

        const headerCode = [
            `/* THIS CODE WAS GENERATED BY CLAMP / BLOCKLY. IT IS NOT INTENDED TO BE READ BY HUMANS IN ITS FULL FORM. */`,
            `// Comments may still appear as they are useful internally.`,
            `console.log("Initializing Project, please wait...");`,
            `const INITIALIZE_BEGIN = Date.now(); // it may be useful in development to see how long it took to initialize`,
            `const variables = {}; // all variables are stored here instead of a "const variable = 123" for each set block`,
            `// this is so we dont end up with a Scratch for Discord where setting a variable with the name "message" breaks everything`,
            `// im allowed to say that because i worked on S4D lolol`,
            `(async function() {`
        ];
        const setupCode = [
            `const characters = {}; // object so we can use invalid characters for character names and still easily access them`,
            `const images = {};`,
            `const sounds = {};`,
            `const characterFunctions = {}; // funny functionz :P this comment is so helpful`
        ];
        const descriptorCode = [
            `const nameTable = {characters:{},images:{},sounds:{}}; // contains the ID: Name for each type`
        ];
        const footerCode = [
            `})(Engine);`
        ];

        // initialize images
        for (const image of this.images) {
            const variableName = JSON.stringify(image.id);
            const variableUserName = JSON.stringify(image.name);
            const variableImage = JSON.stringify(image.image);

            setupCode.push(`images[${variableName}] = await Engine.createImage(${variableName}, ${variableImage});`);
            descriptorCode.push(`nameTable.images[${variableName}] = String(${variableUserName});`);
        };
        // initialize sounds
        for (const sound of this.sounds) {
            const variableName = JSON.stringify(sound.id);
            const variableUserName = JSON.stringify(sound.name);
            const variableData = JSON.stringify(sound.data);

            setupCode.push(`sounds[${variableName}] = await Engine.createSound(${variableName}, ${variableData});`);
            descriptorCode.push(`nameTable.sounds[${variableName}] = String(${variableUserName});`);
        };
        // initialize character code
        for (const character of this.characters) {
            // we need to clean all of these names to ensure they dont generate invalid code
            // so we use things like Number() and JSON.stringify() everywhere
            const variableName = JSON.stringify(character.id);
            const variableUserName = JSON.stringify(character.name);

            const characterData = {
                defaultLook: JSON.stringify(character.startCostume),
                x: isNaN(Number(character.position.x)) ? 0 : Number(character.position.x),
                y: isNaN(Number(character.position.y)) ? 0 : Number(character.position.y),
                size: isNaN(Number(character.size)) ? 0 : Number(character.size),
                angle: isNaN(Number(character.angle)) ? 0 : Number(character.angle),
            };
            setupCode.push(`characters[${variableName}] = new Engine.Character(${variableName}, {
                parent: Engine,
                image: ${characterData.defaultLook},
                position: { x: ${characterData.x}, y: ${characterData.y} },
                size: ${characterData.size / 100},
                rotation: ${characterData.angle},
                origin: { x: "center", y: "center" },
            });`);
            // with the character game object we can now actually run the code for that character
            genCode.push(`characterFunctions[${variableName}](characters[${variableName}]); // run code for character ${variableName}`);
            descriptorCode.push(`nameTable.characters[${variableName}] = String(${variableUserName});`);
        };

        return [].concat(headerCode, descriptorCode, setupCode, [
            // extra stuff that is always the same
            '/* extra events & setup */',
            'console.log("Content Loaded in", (Date.now() - INITIALIZE_BEGIN), "millseconds");',
            'ClampEditor.initializingCode = false; // tell clamp we are finished initializing the project and we can start running the user code',
            'Emitter.emitGlobal("CODE_INITIALIZE_UPDATE"); // read above comment for details; this event is for svelte to update since it cant tell the state changed',
            '// technically thats a Svelte problem that i could report but its such a specific use-case that i dont think its worth fixing',
            '/* ok enough baby stuff LETS RUN SOME CODE */',
        ], genCode.flat(Infinity), footerCode).join('\n');
    }
}

export default Compiler;