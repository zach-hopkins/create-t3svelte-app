import arg from 'arg';
import inquirer from 'inquirer';
import { createT3SvelteApp } from './main.js';

function parseArgumentsIntoOptions(rawArgs) {
    const args = arg(
      {
        '--git': Boolean,
        '--yes': Boolean,
        '--install': Boolean,
        '--db': Boolean,
        '--dbString': String,
        '--dbSolution': String,
        '-g': '--git',
        '-y': '--yes',
        '-i': '--install',
        '-d': '--db'
      },
      {
        argv: rawArgs.slice(2),
      }
    );
    return {
      skipPrompts: args['--yes'] || false,
      git: args['--git'] || false,
      template: args._[0],
      db: args['--db'] || false,
      runInstall: args['--install'] || false,
      dbString: args['--dbString'] || '',
      dbSolution: args['--dbSolution'] || '',
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
   
    const questions = [];
    if (!options.template) {
      questions.push({
        type: 'list',
        name: 'template',
        message: 'Please choose which project template to use',
        choices: [ 'Standard', 'Standard + UI Extras'],
        default: defaultTemplate,
      });
    }
   
    if (!options.git) {
      questions.push({
        type: 'confirm',
        name: 'git',
        message: 'Initialize a git repository?',
        default: false,
      });
    }

    if (!options.runInstall) {
        questions.push({
          type: 'confirm',
          name: 'runInstall',
          message: 'Automatically install dependencies?',
          default: false,
        });
      }
    
    if (!options.db) { 
        questions.push({
        type: 'confirm',
        name: 'db',
        message: 'Configure Database? (N = Unconfigured SQLite)',
        default: false,
      })
    }
    
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


    //Process Forks and Prompt Questions
    const answers = await inquirer.prompt(questions);
    var requireURI = false

    if (answers.db) 
      var dbSolutionAnswers = await inquirer.prompt(dbSolutions)

    if (dbSolutionAnswers)
      requireURI = (dbSolutionAnswers.dbSolution == 'Postgres' || dbSolutionAnswers.dbSolution == 'MySQL' || dbSolutionAnswers.dbSolution == 'MongoDB') ? true : false;

    if (answers.db && requireURI) 
      var dbAnswers = await inquirer.prompt(dbQuestions)

    //Handle Empty Options
    else var dbAnswers = [{dbString: ''}]
    if (!dbSolutionAnswers) var dbSolutionAnswers = [{dbSolution: ''}]
    
    return {
      ...options,
      template: options.template || answers.template,
      git: options.git || answers.git,
      runInstall: options.runInstall || answers.runInstall,
      db: options.db || answers.db,
      dbString: dbAnswers.dbString,
      dbSolution: dbSolutionAnswers.dbSolution
    };
   }

export default async function cli(args) {
     let options = parseArgumentsIntoOptions(args);
     options = await promptForMissingOptions(options);
     await createT3SvelteApp(options)
   }
   