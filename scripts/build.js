const fs = require('fs-extra');
const path = require('path');
const projectDir = '.';
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const tar = require('tar');
const execa = require('execa');

async function updatePackageVersion(packagePath, key, version) {
    let content = fs.readFileSync(packagePath, 'utf8');
    content = content.replace(new RegExp(`"${key}"\\s*:\\s*"[^"]*"`), `"${key}": "${version}"`);
    fs.writeFileSync(packagePath, content);
}

function updateSourceMapFile(path) {
    if (fs.lstatSync(path).isDirectory()) {
        fs.readdirSync(path).forEach(p => updateSourceMapFile(`${path}/${p}`));
    } else if(path.endsWith('js.map')) {
        const content = JSON.parse(fs.readFileSync(path, 'utf8'));
        content.sources[0] = content.sources[0].split('/').pop();
        fs.writeFileSync(path, JSON.stringify(content));
    }
}

async function postBuild(runtimeVersion) {

  // updateSourceMapFile(`${projectDir}/dist/es2015`);

    fs.copySync(`${projectDir}/package.json`, `${projectDir}/dist/es2015/package.json`);

    const packageData = fs.readJSONSync(`${projectDir}/package.json`, {
        encoding: "utf8"
    });
    packageData.main = 'index';
    packageData.module = 'index';
    packageData.exports = {
        ".": "./index"
    };
    delete packageData['files'];

    fs.writeFileSync(`${projectDir}/dist/es2015/package.json`, JSON.stringify(packageData, null, 2))
    await updatePackageVersion(`${projectDir}/dist/es2015/package.json`, 'version', runtimeVersion);
    console.log('Post Build successful!!!');
}

async function prepareNpmPackages(runtimeVersion) {
    fs.copySync(`${projectDir}/dist/es2015`, `${projectDir}/dist/npm-packages/variables`, {
        filter: p => !p.startsWith('/node_modules/')
    });
    //this check is required for repeat builds in local builds to avoid unnecessary copy time
    if(!fs.existsSync(`${projectDir}/dist/npm-packages/variables/node_modules/.bin`)) {
        fs.copySync(`${projectDir}/node_modules`, `${projectDir}/dist/npm-packages/variables/node_modules`);
    }
    await execa('npm', ['pack'], {
        'cwd': `${projectDir}/dist/npm-packages/variables`
    });
    fs.copySync(`${projectDir}/dist/npm-packages/variables/wavemaker-variables-${runtimeVersion}.tgz`, `${projectDir}/dist/npm-packages/wavemaker-variables-${runtimeVersion}.tgz`);
}

async function pushToLocalRepo() {
    fs.writeFileSync(`${projectDir}/dist/new-build`, '' + Date.now);
    await execa('yalc', ['publish' , '--no-sig', '--push'], {
        'cwd': `${projectDir}/dist/es2015`
    });
}

yargs(hideBin(process.argv)).command('post-build',
    'to run post processing after project build',
    (yargs) => {
        yargs.option('runtimeVersion', {
            describe: 'version number',
            type: 'string',
            default: '1.0.0-dev'
        }).option('production', {
            describe: 'to perform a production build',
            type: 'boolean',
            default: false
        });
    }, (argv) => {
        postBuild(argv.runtimeVersion).then(() => {
            if (argv.production) {
                return prepareNpmPackages(argv.runtimeVersion);
            } else {
                return pushToLocalRepo();
            }
        });
    }).showHelpOnFail().argv;
