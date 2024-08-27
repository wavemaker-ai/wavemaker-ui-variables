'use strict';
const fs = require('fs');
const yargs = require('yargs');
const argv = yargs(process.argv).argv;


/**
 * To add the app-ng-runtime package as dependency in angular app package.json
 * @param {*} wm_pkg_name  ng runtime pm package name @wavemaker/app-ng-runtime
 */
const updateVariablesPackage = (path) => {
    if (fs.existsSync(path)) {
        const packageJSON = require('../' + path);
        packageJSON['dependencies']['@wavemaker/variables'] = argv["publish-version"];
        fs.writeFileSync(path, JSON.stringify(packageJSON, null, 4));
    } else {
        console.log('package.json not found at ' + path);
    }
};
const init = () => {
    updateVariablesPackage('../wavemaker-ng-runtime/package.json');
    updateVariablesPackage('../wavemaker-rn-runtime/package.json');
    updateVariablesPackage('../wavemaker-rn-codegen/src/templates/project/package.json');
    updateVariablesPackage('../wavemaker-ng-studio/package.json');
    updateVariablesPackage('../wavemaker-studio-runtime-integration/package.json');
};

init();
