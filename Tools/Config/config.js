const path = require("path");

const config = require("./config.json");
const configFolder = __dirname;

const rootFolder = path.resolve(configFolder, "../../");
const tempFolder = path.resolve(rootFolder, config.build.tempDirectory);
const outputFolder = path.resolve(configFolder, config.build.outputDirectory);
const localDevES6Folder = path.join(tempFolder, config.build.localDevES6FolderName);
const localDevUMDFolder = path.join(tempFolder, config.build.localDevUMDFolderName);
const sourceES6Folder = path.join(tempFolder, config.build.sourceES6FolderName);
const distES6Folder = path.join(tempFolder, config.build.distES6FolderName);
const packageES6Folder = path.join(tempFolder, config.build.packageES6FolderName);

config.computed = {
    rootFolder,
    tempFolder,
    outputFolder,
    localDevES6Folder,
    localDevUMDFolder,
    sourceES6Folder,
    distES6Folder,
    packageES6Folder
}

config.modules.map(function(module) {
    const settings = config[module];

    const mainDirectory = path.resolve(rootFolder, settings.build.mainFolder);
    const distFolder = (settings.build.distOutputDirectory !== undefined) ? settings.build.distOutputDirectory : module;
    const distDirectory = path.join(outputFolder, distFolder);
    const localDevES6Directory = path.join(localDevES6Folder, module);
    const localDevUMDDirectory = path.join(localDevUMDFolder, distFolder);
    const sourceES6Directory = path.join(sourceES6Folder, module);
    const distES6Directory = path.join(distES6Folder, module);
    const packageES6Directory = path.join(packageES6Folder, module);

    const webpackConfigPath = path.join(mainDirectory, "webpack.config.js");
    const tsConfigPath = path.join(mainDirectory, "tsconfig.json");
    const packageJSONPath = settings.build.packageJSON ? 
        path.join(rootFolder, settings.build.packageJSON) : 
        path.join(distDirectory, 'package.json');

    const tsConfig = require(tsConfigPath);
    const srcDirectory = path.resolve(mainDirectory, tsConfig.compilerOptions.rootDir);

    const shaderGlob = srcDirectory + "/**/*.fx";
    const shaderTSGlob = srcDirectory + "/**/*.fx.ts";

    for (let library of settings.libraries) {
        const entryPath = path.join(srcDirectory, library.entry);

        library.computed = {
            entryPath
        };
    }

    settings.computed = {
        mainDirectory,
        srcDirectory,
        distDirectory,
        localDevES6Directory,
        localDevUMDDirectory,
        sourceES6Directory,
        distES6Directory,
        packageES6Directory,
        webpackConfigPath,
        tsConfigPath,
        packageJSONPath,
        shaderGlob,
        shaderTSGlob
    }
});

module.exports = config;