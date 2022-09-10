import chalk from 'chalk';
import fs from 'fs';
import ncp from 'ncp';
import path from 'path';
import { promisify } from 'util';
import { execa }  from 'execa';
import Listr from 'listr';
import { projectInstall } from 'pkg-install';

const access = promisify(fs.access);
const copy = promisify(ncp);

async function copyTemplateFiles(options) {
 return copy(options.templateDirectory, options.targetDirectory, {
   clobber: false,
 });
}

 async function configureDatabase(options) {
    await copyEnvFile(options)
    const resultPull = await execa('npx', ['prisma', 'db', 'pull'], {
        cwd:options.targetDirectory
    })
    const resultGenerate = await execa('npx', ['prisma', 'generate'], {
        cwd:options.targetDirectory
    })
    if (resultPull.failed || resultGenerate.failed) {
        return Promise.reject(new Error('Failed to intialize DB via Prisma'))
    }
    return;
 }

 async function copyEnvFile(options) {
    const content = `DATABASE_URL="${options.dbString}"`
    const file = options.targetDirectory + '/.env'
    fs.writeFile(file, content, function (err) {
        if (err) { throw err
        }
        return
    })
 }

async function initGit(options) {
    const result = await execa('git', ['init'], {
      cwd: options.targetDirectory,
    });
    if (result.failed) {
      return Promise.reject(new Error('Failed to initialize git'));
    }
    return;
   }

export async function createT3SvelteApp(options) {
 options = {
   ...options,
   targetDirectory: options.targetDirectory || process.cwd(),
 };

 const currentFileUrl = import.meta.url;
 const templateDir = path.resolve(
   new URL(currentFileUrl).pathname,
   '../../templates',
   options.template.toLowerCase()
 );
 options.templateDirectory = templateDir;

 try {
   await access(templateDir, fs.constants.R_OK);
 } catch (err) {
   console.log(templateDir)
   console.error('%s Invalid template name', chalk.red.bold('ERROR'));
   process.exit(1);
 }
 
 await copyTemplateFiles(options);

 const tasks = new Listr([
    {
      title: 'Copy project files',
      task: () => copyTemplateFiles(options),
    },
    {
      title: 'Initialize git',
      task: () => initGit(options),
      enabled: () => options.git,
    },
    {
      title: 'Install dependencies',
      task: () =>
        projectInstall({
          cwd: options.targetDirectory,
        }),
        enabled: () => options.runInstall,
    },
    {
        title: 'Initialize DB',
        task: () => configureDatabase(options),
        enabled: () => options.db,
      },
  ]);

 await tasks.run();
 console.log('%s SvelteT3 is ready!', chalk.green.bold('DONE'));
 return true;
}
