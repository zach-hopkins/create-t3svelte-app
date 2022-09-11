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
      dbString: args['--dbString'] || ''
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
        choices: [ 'Standard', 'Deluxe'],
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
        message: 'Initialize Postgres DB w/ Prisma? (Requires DB URI String)',
        default: false,
      })
    }

    const dbQuestions = []
    dbQuestions.push({
        type: 'password',
        name: 'dbString',
        mask: true,
        message: 'Enter Full DB URI String (Postgres)',
    })
   
    const answers = await inquirer.prompt(questions);
    if (answers.db === true) {
        var dbAnswers = await inquirer.prompt(dbQuestions)
        
    }
    
    return {
      ...options,
      template: options.template || answers.template,
      git: options.git || answers.git,
      runInstall: options.runInstall || answers.runInstall,
      db: options.db || answers.db,
      dbString: options.dbString || dbAnswers.dbString
    };
   }

export default async function cli(args) {
     let options = parseArgumentsIntoOptions(args);
     options = await promptForMissingOptions(options);
     await createT3SvelteApp(options)
   }
   