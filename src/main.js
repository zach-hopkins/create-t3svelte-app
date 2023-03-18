import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'path'
import { promisify } from 'util'
import { execa } from 'execa'
import { fileURLToPath } from 'url'
import Listr from 'listr'
import { projectInstall } from 'pkg-install'
import { exec } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const access = promisify(fs.access)

// CREDIT: https://github.com/t3-oss/create-t3-app/blob/44a107b8d5345023bafc8a773322e5ee39ba8580/cli/src/utils/getUserPkgManager.ts
function getUserPkgManager() {
  // This environment variable is set by npm and yarn but pnpm seems less consistent
  const userAgent = process.env.npm_config_user_agent;

  if (userAgent) {
    if (userAgent.startsWith("yarn")) {
      return "yarn";
    } else if (userAgent.startsWith("pnpm")) {
      return "pnpm";
    } else {
      return "npm";
    }
  } else {
    // If no user agent is set, assume npm
    return "npm";
  }
};

const userPkgManager = getUserPkgManager()
console.log('Using: %s ', chalk.green.bold(userPkgManager))

async function copyTemplateFiles(options, templateName = 'overwrites', templateBaseDir = '/') {
  await fs.copy(options.templateDirectory, options.targetDirectory)
  await fs.writeFile(options.targetDirectory + "/.npmrc", "engine-strict=true")
  await fs.writeFile(options.targetDirectory + "/.gitignore", ".DS_Store\nnode_modules\n/build\n/.svelte-kit\n/package\n.env")
  if (templateName != 'standard' && templateName != 'overwrites') await copyOptionalFiles(options, templateBaseDir)
  return
}

async function copyOptionalFiles(options, templateBaseDir) {
  let dirArray = []
  let selectedOptionals = []
  const scriptLang = options.scriptLang.toLowerCase()

  for (const [key, value] of Object.entries(options.optionals)) {
    if (value === true) selectedOptionals.push(key)
  }

  /* set dirs for optional additions */

  //Tech Stack
  if (selectedOptionals.includes('prisma') && selectedOptionals.includes('svelteKitAuth') && selectedOptionals.includes('trpc'))
    dirArray.push(templateBaseDir + '+prisma_sveltekitauth_trpc')
  else if (selectedOptionals.includes('prisma') && selectedOptionals.includes('trpc'))
    dirArray.push(templateBaseDir + '+prisma_trpc')
  else if (selectedOptionals.includes('prisma') && selectedOptionals.includes('svelteKitAuth'))
    dirArray.push(templateBaseDir + '+prisma_sveltekitauth')
  else if (selectedOptionals.includes('trpc')) dirArray.push(templateBaseDir + '+trpc')
  else if (selectedOptionals.includes('prisma')) dirArray.push(templateBaseDir + '+prisma')
  else if (selectedOptionals.includes('svelteKitAuth')) dirArray.push(templateBaseDir + '+sveltekitauth')

  if (selectedOptionals.includes('tailwind')) dirArray.push(templateBaseDir + '+tailwind')

  //Tooling
  if (selectedOptionals.includes('eslint') && selectedOptionals.includes('prettier')) {
    if (scriptLang == 'typescript') dirArray.push(templateBaseDir + '+eslint_prettier_typescript')
    else dirArray.push(templateBaseDir + '+eslint_prettier_javascript')
  } else if (selectedOptionals.includes('eslint')) {
    if (scriptLang == 'typescript') dirArray.push(templateBaseDir + '+eslint_typescript')
    else dirArray.push(templateBaseDir + '+eslint_javascript')
  } else if (selectedOptionals.includes('prettier')) dirArray.push(templateBaseDir + '+prettier')

  if (selectedOptionals.includes('heroIcons')) dirArray.push(templateBaseDir + '+heroicons')

  if (selectedOptionals.includes('headlessUI')) dirArray.push(templateBaseDir + '+headlessui')

  if (selectedOptionals.includes('tailwindPrettier'))
    dirArray.push(templateBaseDir + '+tailwind_prettier_plugin')

  const npmCommands = await compileInstalls(dirArray)

  for (let urlIndex in dirArray) {
    fs.copySync(dirArray[urlIndex], options.targetDirectory)
  }

  for (let commandIndex in npmCommands) {
    await new Promise(function(resolve, reject) {
      exec(npmCommands[commandIndex], (err, stdout, stderr) => {
        if (err) {
          reject(err)
        } else {
          resolve({ stdout, stderr })
        }
      })
    })
  }

  //cleanup package.txt
  fs.removeSync(options.targetDirectory + '/package.txt')

  return
}

async function compileInstalls(dirArray) {
  //read package.txt for each optional package to configure package.json
  let npmCommands = []
  for (let urlIndex in dirArray) {
    let lines = fs.readFileSync(dirArray[urlIndex] + '/package.txt', 'utf8').replace('\n', '')
    if (userPkgManager === 'pnpm') {
      lines = lines
        .replace(/npm/g, 'pnpm')
        .replace(/--no-package-lock /g, '')
        .replace(/--package-lock-only/g, '--lockfile-only')
    } else if (userPkgManager === 'yarn') {
      lines = lines
        .replace(/npm install/g, 'yarn add')
        .replace(/--no-package-lock /g, '')
        .replace(/--package-lock-only/g, '--mode update-lockfile')
    }
    npmCommands.push(lines)
  }
  return npmCommands
}

async function configureDatabase(options) {
  await copyEnvFile(options)
  const operation = options.dbOperation == 'Import Existing Schema' ? 'pull' : 'push'
  const basePath = options.templateDirectory.split('/templates')[0]
  const overwriteFolder = options.dbSolution.toLowerCase()
  const customOptions = {
    targetDirectory: options.targetDirectory,
    templateDirectory: basePath + '/overwrites/' + overwriteFolder
  }

  const overwriteRequired = ['postgres', 'mysql', 'mongodb'] //add DBs requiring overwrite here
  if (overwriteRequired.includes(overwriteFolder)) //guard clause to only overwrite when needed (Postgres, mySQL, mongodb etc) 
    await copyTemplateFiles(customOptions)

  const resultPull = await execa('npx', ['prisma', 'db', operation], {
    cwd: options.targetDirectory,
  })
  if (operation == 'pull') {
    const resultGenerate = await execa('npx', ['prisma', 'generate'], {
      cwd: options.targetDirectory,
    })
    if (resultGenerate.failed) return Promise.reject(new Error('Failed to intialize DB via Prisma'))
  }
  if (resultPull.failed) {
    return Promise.reject(new Error('Failed to intialize DB via Prisma'))
  }
  return
}

async function copyEnvFile(options) {
  const content = `DATABASE_URL="${options.dbString}"`
  const file = options.targetDirectory + '/.env'
  fs.writeFile(file, content, function(err) {
    if (err) {
      throw err
    }
    return
  })
}

async function initGit(options) {
  const result = await execa('git', ['init'], {
    cwd: options.targetDirectory,
  })

  if (result.failed) {
    console.log('Failed to init git')
    return Promise.reject(new Error('Failed to initialize git'))
  }
  return
}

export async function createT3SvelteApp(options) {
  options = {
    ...options,
    targetDirectory: options.targetDirectory || process.cwd(),
  }
  const templateBaseDir = path.resolve(__filename, '../../templates')
  const templateName = options.template.toLowerCase()
  let templateDir = ''

  if (templateName == 'standard') templateDir = templateBaseDir + '/standard'
  else if (templateName == 'custom: typescript') templateDir = templateBaseDir + '/base_typescript'
  else templateDir = templateBaseDir + '/base_javascript'

  options.templateDirectory = templateDir

  try {
    await access(templateDir, fs.constants.R_OK)
  } catch (err) {
    console.log(templateDir)
    console.error('%s Invalid template name', chalk.red.bold('ERROR'))
    process.exit(1)
  }

  const tasks = new Listr([
    {
      title: 'Copy project files',
      task: () => copyTemplateFiles(options, templateName, templateBaseDir + '/'),
    },
    {
      title: 'Initialize git',
      task: () => initGit(options),
      enabled: () => options.git,
    },
    {
      title: 'Install dependencies',
      task: () => {
        projectInstall({
          prefer: userPkgManager,
          cwd: options.targetDirectory,
        })
      },
      enabled: () => options.runInstall,
    },
    {
      title: 'Initialize DB',
      task: () => configureDatabase(options),
      enabled: () => options.db,
    },
  ])

  await tasks.run()
  console.log('%s SvelteT3 is ready!', chalk.green.bold('DONE'))
  return true
}
