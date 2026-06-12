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
    delete packageData['files'];

    fs.writeFileSync(`${projectDir}/dist/es2015/package.json`, JSON.stringify(packageData, null, 2))
    await updatePackageVersion(`${projectDir}/dist/es2015/package.json`, 'version', runtimeVersion);
    console.log('Post Build successful!!!');
}

async function createPackageLock(path) {
    await execa('npm', ['install', '--package-lock-only', '--ignore-scripts'], {
        'cwd': path
    });
    const packageJSON = fs.readJSONSync(`${path}/package-lock.json`);
    Object.values(packageJSON.packages || {}).map(v => {
        delete v.resolved;
    });
    fs.writeJSONSync(`${path}/package-lock.json`, packageJSON, {
        spaces: 4
    });
    fs.writeJSONSync(`${path}/npm-shrinkwrap.json`, packageJSON, {
        spaces: 4
    });
}

async function prepareNpmPackages(runtimeVersion) {
    let tarballName=`wavemaker-variables-${runtimeVersion}.tgz`
    fs.copySync(`${projectDir}/dist/es2015`, `${projectDir}/dist/npm-packages/package`, {
        filter: p => !p.startsWith('/node_modules/')
    });
    await createPackageLock(`${projectDir}/dist/npm-packages/package`);
    await execa('tar', ['-czf', `dist/npm-packages/${tarballName}`, '-C', 'dist/npm-packages', 'package'], {
        'cwd': `${projectDir}`
    });
    let tarballPath = path.join(__dirname, `../dist/npm-packages/${tarballName}`)
    const { stdout } = await execa('node', ['../process-npm-package-stats.js', `--path=${tarballPath}`, '--packageName=@wavemaker/variables', `--publishVersion=${runtimeVersion}`]);
    console.log(stdout);
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
