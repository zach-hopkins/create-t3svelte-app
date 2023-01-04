import arg from "arg";
import inquirer from "inquirer";
import { createT3SvelteApp } from "./main.js";

type CheckBoxChoices = readonly { name: string; checked?: boolean }[];
type ListChoices = readonly string[];

type Question<T extends ListChoices | CheckBoxChoices> = {
  message: string;
  readonly choices?: T;
  default?: string;
  mask?: boolean;
};

type InquirersTransform<T extends Record<string, Question<ListChoices | CheckBoxChoices>>> = { [P in keyof T]: InquirersRecordValue<T[P]> };
type InquirersRecordValue<T extends Question<ListChoices | CheckBoxChoices>> = T["choices"] extends CheckBoxChoices
  ? Array<string>
  : T["choices"] extends ListChoices
  ? T["choices"][number]
  : string;

const prompt = async <T extends Record<string, Question<ListChoices | CheckBoxChoices>>>(questions: T) => {
  const transformedQuestions = Object.entries(questions).map(([name, question]) => {
    const choices = question.choices;
    const type = choices ? (typeof choices[0] === "string" ? "list" : "checkbox") : question.mask ? "password" : "input";

    return {
      ...question,
      name,
      type,
    };
  });
  const answers = await inquirer.prompt(transformedQuestions);
  return answers as InquirersTransform<T>;
};

const parseArgumentsIntoOptions = (rawArgs: string[]) => {
  const args = arg({ "--yes": Boolean }, { argv: rawArgs.slice(2) });
  return {
    skipPrompts: args["--yes"] || false,
    template: args._[0],
  };
};

export const promptForMissingOptions = async (options: ReturnType<typeof parseArgumentsIntoOptions>) => {
  const defaultTemplate = "TypeScript";

  // Removed sinces it's not fully implemented yet
  /* if (options.skipPrompts && false) {
    return {
      ...options,
      template: options.template || defaultTemplate,
      targetDirectory: "create-t3svelte-app" + new Date().toString(),
    };
  } */

  const baseQuestions = {
    targetDirectory: {
      message: "Please choose project name:",
    },
    template: {
      message: "Please choose which project template to use",
      choices: [/* "Standard",  */ "TypeScript", "JavaScript"] as const, // removed standard since it's not fully implemented yet (or at least didn't work for me all the time)
      default: defaultTemplate,
    },
  };

  const typeScriptQuestions = {
    options: {
      message: "Please choose tech stack options",
      choices: [
        { name: "tRPC", checked: true },
        { name: "Prisma ORM", checked: true },
        { name: "Tailwind CSS", checked: true },
      ] as const,
    },
  };

  const javaScriptQuestions = {
    options: {
      message: "Please choose tech stack options",
      choices: [
        { name: "Prisma ORM", checked: true },
        { name: "Tailwind CSS", checked: true },
      ] as const,
    },
  };

  let toolQuestions = {
    options: {
      message: "Please choose tech stack options",
      choices: [
        { name: "ESLint", checked: true },
        { name: "Prettier", checked: true },
        { name: "Tailwind Prettier", checked: true },
        { name: "Headless UI" },
        { name: "HeroIcons" },
      ] as const,
    },
  };

  const configQuestions = {
    options: {
      message: "Please choose config options",
      choices: [
        { name: "Configure database", checked: true },
        { name: "Init .git", checked: true },
        { name: "Auto install dependencies", checked: true },
      ] as const,
    },
  };

  const dbSolutions = {
    dbSolution: {
      message: "What DB technology are you using? (first 3 require URI string)",
      choices: ["Postgres", "MySQL", "MongoDB", "SQLite", "Other"] as const,
      default: "Postgres",
    },
  };

  //Inquirer Fork 3 (if needed)
  const dbQuestions = {
    dbString: {
      mask: true,
      message: "Enter Full DB URI String:",
    },
    dbOperation: {
      message: "Init new DB schema (blank DB) or import schema from existing DB?",
      choices: ["New Schema", "Import Existing Schema"] as const,
      default: "New Schema",
    },
  } as const;

  /*                                    */
  /* Process Forks and Prompt Questions */

  let techOptions: string[] = ["tRPC", "Prisma ORM", "Tailwind CSS", "TypeScript"];
  let toolOptions: string[] = ["ESLint", "Prettier", "Tailwind Prettier"];
  let isStandard = false;

  // Base Config
  const baseAnswers = await prompt(baseQuestions);
  switch (baseAnswers.template) {
    case "TypeScript":
      const typescriptAnswers = await prompt(typeScriptQuestions);
      techOptions = [...typescriptAnswers.options, "TypeScript"];
      break;
    case "JavaScript":
      const javascriptAnswers = await prompt(javaScriptQuestions);
      techOptions = [...javascriptAnswers.options, "JavaScript"];
      break;
    default:
      isStandard = true;
  }

  // Non-Standard Config
  if (!isStandard) {
    if (techOptions.includes("Tailwind CSS")) {
      const toolAnswers = await prompt(toolQuestions);
      toolOptions = toolAnswers.options;
    } else {
      // remove Tailwind Prettier from toolOptions
      const newToolChoices = toolQuestions.options.choices.filter((object) => object.name !== "Tailwind Prettier");
      const newToolQuestions = { ...toolQuestions, options: { ...toolQuestions.options, choices: newToolChoices } };

      const toolAnswers = await prompt(newToolQuestions);
      toolOptions = toolAnswers.options;
    }
  }

  // Package Config
  let configOptions: string[] = [];

  // Since we don't support PNPM yet, we need to remove the option to install packages with it
  const userAgent = process.env.npm_config_user_agent;
  const isPNPM = userAgent && userAgent.includes("pnpm");
  const pnpmRemovedConfig = configQuestions.options.choices.filter((object) => object.name !== "Auto install dependencies");

  const correctedConfig = {
    ...configQuestions,
    options: { ...configQuestions.options, choices: isPNPM ? pnpmRemovedConfig : configQuestions.options.choices },
  };

  if (techOptions.includes("Prisma ORM")) {
    const configAnswers = await prompt(correctedConfig);
    configOptions = configAnswers.options;
  } else {
    // remove Configure database from configOptions
    const newConfigChoices = correctedConfig.options.choices.filter((object) => object.name !== "Configure database");
    const newConfigQuestionsRMDB = { ...correctedConfig, options: { ...correctedConfig.options, choices: newConfigChoices } };

    const configAnswers = await prompt(newConfigQuestionsRMDB);
    configOptions = configAnswers.options;
  }

  // Database Config
  let requireURI = false;
  let dbSolution = "none";
  let dbConfig = null;

  const needsDatabase = configOptions.includes("Configure database");
  if (configOptions.includes("Configure database")) dbSolution = (await prompt(dbSolutions)).dbSolution;
  if (dbSolution) requireURI = ["Postgres", "MySQL", "MongoDB"].includes(dbSolution);

  //Handle Empty Options
  if (needsDatabase && requireURI) dbConfig = await prompt(dbQuestions);
  else dbConfig = { dbString: "none", dbOperation: "New Schema" };

  //Manage Options
  const template = baseAnswers.template;
  const targetDirectory = baseAnswers.targetDirectory.replace(/( |_)/g, "-").toLowerCase();

  //Tech Stack
  const trpc = techOptions.includes("tRPC");
  const prisma = techOptions.includes("Prisma ORM");
  const scriptLang = techOptions.includes("TypeScript") ? "TypeScript" : "JavaScript";
  const tailwind = techOptions.includes("Tailwind CSS");

  //Tooling
  const eslint = toolOptions.includes("ESLint");
  const prettier = toolOptions.includes("Prettier");
  const tailwindPrettier = toolOptions.includes("Tailwind Prettier") && prettier ? true : false;
  const headlessUI = toolOptions.includes("Headless UI");
  const heroIcons = toolOptions.includes("HeroIcons");

  //Configs
  const git = configOptions.includes("Init .git");
  const runInstall = configOptions.includes("Auto install dependencies");
  const db = configOptions.includes("Configure database");

  return {
    ...options,
    targetDirectory: targetDirectory || process.cwd(),
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
    dbString: dbConfig.dbString,
    dbOperation: dbConfig.dbOperation,
    dbSolution: dbSolution,
  };
};

const cli = async (args: string[]) => {
  const passedOptions = parseArgumentsIntoOptions(args);
  const completeOptions = await promptForMissingOptions(passedOptions);
  await createT3SvelteApp(completeOptions);
};

export type MinimalOptions = { template: string; skipPrompts: boolean };
export type Options = MinimalOptions & {
  targetDirectory: string;
  scriptLang: string;
  optionals: {
    trpc: boolean;
    prisma: boolean;
    tailwind: boolean;
    eslint: boolean;
    prettier: boolean;
    tailwindPrettier: boolean;
    headlessUI: boolean;
    heroIcons: boolean;
  };
  git: boolean;
  runInstall: boolean;
  db: boolean;
  dbString: string;
  dbOperation: string;
  dbSolution: string;
};

export default cli;
