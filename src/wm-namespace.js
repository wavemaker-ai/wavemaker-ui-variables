/**
 * Central WaveMaker npm namespace configuration.
 *
 * All source files import WM_NPM_SCOPE from here instead of hardcoding
 * '@wavemaker'. Override via the WM_NPM_SCOPE environment variable to
 * switch namespaces at build or runtime.
 *
 * Default: '@wavemaker-ai'
 * Override: WM_NPM_SCOPE=@wavemaker node scripts/build.js post-build
 */
const WM_NPM_SCOPE = process.env.WM_NPM_SCOPE || '@wavemaker-ai';

module.exports = { WM_NPM_SCOPE };
