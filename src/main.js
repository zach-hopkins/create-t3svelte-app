import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'path'
import { promisify } from 'util'
import { execa } from 'execa'
import { fileURLToPath } from 'url';
import Listr from 'listr'
import { projectInstall } from 'pkg-install'

const __filename = fileURLToPath(import.meta.url);
const access = promisify(fs.access)

async function copyTemplateFiles(options, templateName, templateBaseDir) {
	await fs.copy(options.templateDirectory, options.targetDirectory)
	if (templateName != 'standard') await copyOptionalFiles(options, templateBaseDir)
	return
}

async function copyOptionalFiles(options, templateBaseDir) {
	let dirArray = []
	let selectedOptionals = []
	const scriptLang = options.scriptLang.toLowerCase()
	
	for (const [key, value] of Object.entries(options.optionals)) {
		console.log(`${key} ${value}`)
		if (value === true) selectedOptionals.push(key)
	  }

	/* set dirs for optional additions */

	//Tech Stack
	if (selectedOptionals.includes('prisma') && selectedOptionals.includes('trpc'))
		dirArray.push(templateBaseDir + '+prisma_trpc')
	else if (selectedOptionals.includes('trpc'))
		dirArray.push(templateBaseDir + '+trpc')
	else if (selectedOptionals.includes('prisma'))
		dirArray.push(templateBaseDir + '+prisma')

	if (selectedOptionals.includes('tailwind'))
	  dirArray.push(templateBaseDir + '+tailwind')

	//Tooling
	if (selectedOptionals.includes('eslint') && selectedOptionals.includes('prettier')) {
		if (scriptLang == 'typescript')
			dirArray.push(templateBaseDir + '+eslint_prettier_typescript')
		else
			dirArray.push(templateBaseDir + '+eslint_prettier_javascript')
	}
	else if (selectedOptionals.includes('eslint')) {
		if (scriptLang == 'typescript')
			dirArray.push(templateBaseDir + '+eslint_typescript')
		else
			dirArray.push(templateBaseDir + '+eslint_javascript')
	}
	else if (selectedOptionals.includes('prettier'))
		dirArray.push(templateBaseDir + '+prettier')

	if (selectedOptionals.includes('heroIcons'))
		dirArray.push(templateBaseDir + '+heroicons')
	
	if (selectedOptionals.includes('headlessUI'))
		dirArray.push(templateBaseDir + '+headlessui')

	if (selectedOptionals.includes('tailwindPrettier'))
		dirArray.push(templateBaseDir + '+tailwind_prettier_plugin')

	console.log("Paths: " + dirArray)

	//const npmCommands = await compileInstalls(dirArray)

	for (let urlIndex in dirArray) {
		console.log(dirArray[urlIndex])
		fs.copySync(dirArray[urlIndex], options.targetDirectory)
	}

	return

}

async function compileInstalls(dirArray) {
	//read package.txt for each optional package to configure package.json
	let npmCommands = []
		for (let urlIndex in dirArray) {
			let lines = fs.readFileSync(dirArray[urlIndex] + '/package.txt', 'utf8').replace("\n","")
				npmCommands.push(lines)
		}
	return npmCommands

}

async function configureDatabase(options) {
	await copyEnvFile(options)
	const operation = options.dbOperation == 'Import Existing Schema' ? 'pull' : 'push'
	const basePath = options.templateDirectory.split('/templates')[0]
	if (options.dbSolution == 'Postgres') {
		//copy postgres/schema.prisma to options.targetDirectory
		const customOptions = {
			targetDirectory: options.targetDirectory,
			templateDirectory: basePath + '/overwrites/postgres',
		}
		await copyTemplateFiles(customOptions)
	} else if (options.dbSolution == 'MongoDB' || options.dbSolution == 'MySQL') {
		const overwriteFolder = options.dbSolution.toLowerCase()
		//copy overwriteFolder/schema.prisma to options.targetDirectory
		const customOptions = {
			targetDirectory: options.targetDirectory,
			templateDirectory: basePath + '/overwrites/' + overwriteFolder,
		}
		await copyTemplateFiles(customOptions)
	}
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
	fs.writeFile(file, content, function (err) {
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

	if (templateName == 'standard') templateDir = templateBaseDir + '/standard_typescript'
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
			task: () => copyTemplateFiles(options, templateName, templateBaseDir + "/"),
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
	])

	await tasks.run()
	console.log('%s SvelteT3 is ready!', chalk.green.bold('DONE'))
	return true
}
