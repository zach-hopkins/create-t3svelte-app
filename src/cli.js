import arg from 'arg';
import inquirer from 'inquirer';
import { createT3SvelteApp } from './main.js';

function parseArgumentsIntoOptions(rawArgs) {
    const args = arg(
      {
        '--yes': Boolean,
      },
      {
        argv: rawArgs.slice(2),
      }
    );
    return {
      skipPrompts: args['--yes'] || false,
      template: args._[0],
    };
   }


   async function promptForMissingOptions(options) {
    const defaultTemplate = 'Standard';
    if (options.skipPrompts) {
      return {
        ...options,
        template: options.template || defaultTemplate,
      };
    }
   
    const baseQuestion = [];
    if (!options.template) {
      baseQuestion.push({
        type: 'list',
        name: 'template',
        message: 'Please choose which project template to use',
        choices: [ 'Standard', 'Custom: TypeScript', 'Custom: JavaScript'],
        default: defaultTemplate,
      });
    }

    const typeScriptQuestions = []

    typeScriptQuestions.push({
      type: 'checkbox',
      name: 'options',
      message: 'Please choose tech stack options',
      choices: [
       {name: 'tRPC', checked: true}, {name: 'Prisma ORM', checked: true}, {name: 'Tailwind CSS', checked: true}
      ],
    });

    const javaScriptQuestions = []

    javaScriptQuestions.push({
      type: 'checkbox',
      name: 'options',
      message: 'Please choose tech stack options',
      choices: [
        {name: 'Prisma ORM', checked: true}, {name: 'Tailwind CSS', checked: true}
      ],
    });

    const toolQuestions = []

    toolQuestions.push({
      type: 'checkbox',
      name: 'options',
      message: 'Please choose tech stack options',
      choices: [
        {name: 'ESLint', checked: true}, {name: 'Prettier', checked: true}, {name: 'Tailwind Prettier'}, {name: 'Headless UI'}, {name: 'HeroIcons'}
      ],
    });


    const configQuestions = []
    const configQuestionsNoPrisma = []

    configQuestions.push({
      type: 'checkbox',
      name: 'options',
      message: 'Please choose config options',
      choices: [
        {name: 'Configure database', checked: true }, {name: 'Init .git', checked: true}, {name: 'Auto install dependencies', checked: true},
      ],
    });

    configQuestionsNoPrisma.push({
      type: 'checkbox',
      name: 'options',
      message: 'Please choose config options',
      choices: [
        {name: 'Init .git', checked: true}, {name: 'Auto install dependencies', checked: true},
      ],
    });


    
    //Inquirer Fork 2 (if needed)
    const dbSolutions = []
    
    dbSolutions.push({
      type: 'list',
      name: 'dbSolution',
      message: 'What DB technology are you using? (first 3 require URI string)',
      choices: ['Postgres', 'MySQL', 'MongoDB', 'SQLite', 'Other'],
      default: 'Postgres'
  })

    //Inquirer Fork 3 (if needed)
    const dbQuestions = []

    dbQuestions.push({
        type: 'password',
        name: 'dbString',
        mask: true,
        message: 'Enter Full DB URI String',
    })

    dbQuestions.push({
      type: 'list',
      name: 'dbOperation',
      message: 'Init new DB schema (blank DB) or import schema from existing DB?',
      choices: [ 'New Schema', 'Import Existing Schema'],
      default: 'New Schema'
    })

    /*                                    */
    /* Process Forks and Prompt Questions */

    const baseTemplate = await inquirer.prompt(baseQuestion) //get base template
    let techOptions = {}
    let requireURI = false

    switch (baseTemplate.template) {
      case 'Custom: TypeScript': 
        techOptions = (await inquirer.prompt(typeScriptQuestions)).options
        techOptions.push('TypeScript')
        break;
      case 'Custom: JavaScript':
        techOptions = (await inquirer.prompt(javaScriptQuestions)).options
        techOptions.push('JavaScript')
        break;
      default: //standard
        techOptions = [ 'tRPC', 'Prisma ORM', 'Tailwind CSS', 'TypeScript' ]
    }

    const toolOptions = (await inquirer.prompt(toolQuestions)).options

    if (techOptions.includes('Prisma ORM'))
      var configOptions = (await inquirer.prompt(configQuestions)).options
    else 
      var configOptions = (await inquirer.prompt(configQuestionsNoPrisma)).options
    

    const needsDatabase = configOptions.includes("Configure database") ? true : false
    if (needsDatabase)
      var dbSolutionAnswers = await inquirer.prompt(dbSolutions)

    if (dbSolutionAnswers)
      requireURI = (dbSolutionAnswers.dbSolution == 'Postgres' || dbSolutionAnswers.dbSolution == 'MySQL' || dbSolutionAnswers.dbSolution == 'MongoDB') ? true : false;

    if (needsDatabase && requireURI) 
      var dbAnswers = await inquirer.prompt(dbQuestions)

    //Handle Empty Options
    else { 
      var dbAnswers = {
        dbString: 'none',
        dbOperation: 'New Schema'
      } 
    }
    if (!dbSolutionAnswers) var dbSolutionAnswers = {dbSolution: 'none'}

    //Manage Options
    const template = baseTemplate.template

    //Tech Stack
    const trpc = techOptions.includes('tRPC')
    const prisma = techOptions.includes('Prisma ORM')
    const scriptLang = techOptions.includes('TypeScript') ? "TypeScript" : "JavaScript"
    const tailwind = techOptions.includes('Tailwind CSS')

    //Tooling
    const eslint = toolOptions.includes('ESLint')
    const prettier = toolOptions.includes('Prettier')
    const tailwindPrettier = toolOptions.includes('Tailwind Prettier')
    const headlessUI = toolOptions.includes('Headless UI')
    const heroIcons = toolOptions.includes('HeroIcons')

    //Configs
    const git = configOptions.includes('Init .git')
    const runInstall = configOptions.includes('Auto install dependencies')
    const db = configOptions.includes('Configure database')

    return {
      ...options,
      template: options.template || template,

      //Tech Stack
      scriptLang: scriptLang,
      optionals: {
        trpc: trpc,
        prisma: prisma,
        tailwind: tailwind,

        //Tooling
        eslint: eslint,
        prettier: prettier,
        tailwindPrettier: tailwindPrettier,
        headlessUI: headlessUI,
        heroIcons: heroIcons,
      },
      //Configs
      git: git,
      runInstall: runInstall,
      db: db,

      //DB Specific
      dbString: dbAnswers.dbString,
      dbOperation: dbAnswers.dbOperation,
      dbSolution: dbSolutionAnswers.dbSolution
    };
   }

export default async function cli(args) {
     let options = parseArgumentsIntoOptions(args);
     options = await promptForMissingOptions(options);
     await createT3SvelteApp(options)
   }
   