import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import { promisify } from "util";
import { execa } from "execa";
import { fileURLToPath } from "url";
import Listr from "listr";
import { projectInstall } from "pkg-install";
import { exec } from "child_process";

import { type Options } from "./cli.js";

const __filename = fileURLToPath(import.meta.url);
const access = promisify(fs.access);

type PackageManager = "npm" | "pnpm" | "yarn";
const getUserPkgManager: () => PackageManager = () => {
  // This environment variable is set by npm and yarn but pnpm seems less consistent
  const userAgent = process.env.npm_config_user_agent;

  if (userAgent && userAgent.includes("yarn")) return "yarn";
  if (userAgent && userAgent.includes("pnpm")) return "pnpm";

  return "npm";
};

const userPkgManager = getUserPkgManager();
console.log("Using: %s ", chalk.green.bold(userPkgManager));
console.log("Warning, PNPM is not supported for installation yet...\n");

const copyTemplateFiles = async (options: Options & { templateDirectory: string }, templateName = "overwrites", templateBaseDir = "/") => {
  await fs.copy(options.templateDirectory, options.targetDirectory);
  await fs.writeFile(options.targetDirectory + "/.npmrc", "engine-strict=true");
  await fs.writeFile(options.targetDirectory + "/.gitignore", ".DS_Store\nnode_modules\n/build\n/.svelte-kit\n/package\n.env");
  if (templateName != "standard" && templateName != "overwrites") await copyOptionalFiles(options, templateBaseDir);
};

const copyOptionalFiles = async (options: Options, templateBaseDir: string) => {
  const scriptLang = options.scriptLang.toLowerCase();

  const selectedOptionals = [];
  for (const [key, value] of Object.entries(options.optionals)) if (value === true) selectedOptionals.push(key);

  const dirArray = [];

  /* set dirs for optional additions */

  //Tech Stack
  if (selectedOptionals.includes("prisma") && selectedOptionals.includes("trpc")) dirArray.push(templateBaseDir + "+prisma_trpc");
  else if (selectedOptionals.includes("trpc")) dirArray.push(templateBaseDir + "+trpc");
  else if (selectedOptionals.includes("prisma")) dirArray.push(templateBaseDir + "+prisma");

  if (selectedOptionals.includes("tailwind")) dirArray.push(templateBaseDir + "+tailwind");

  //Tooling
  if (selectedOptionals.includes("eslint") && selectedOptionals.includes("prettier")) {
    if (scriptLang == "typescript") dirArray.push(templateBaseDir + "+eslint_prettier_typescript");
    else dirArray.push(templateBaseDir + "+eslint_prettier_javascript");
  } else if (selectedOptionals.includes("eslint")) {
    if (scriptLang == "typescript") dirArray.push(templateBaseDir + "+eslint_typescript");
    else dirArray.push(templateBaseDir + "+eslint_javascript");
  } else if (selectedOptionals.includes("prettier")) dirArray.push(templateBaseDir + "+prettier");

  if (selectedOptionals.includes("heroIcons")) dirArray.push(templateBaseDir + "+heroicons");

  if (selectedOptionals.includes("headlessUI")) dirArray.push(templateBaseDir + "+headlessui");

  if (selectedOptionals.includes("tailwindPrettier")) dirArray.push(templateBaseDir + "+tailwind_prettier_plugin");

  const npmCommands = await compileInstalls(dirArray);
  for (const urlIndex in dirArray) fs.copySync(dirArray[urlIndex]!, options.targetDirectory);

  for (const commandIndex in npmCommands) {
    await new Promise((resolve, reject) => {
      exec(npmCommands[commandIndex]!, (err, stdout, stderr) => (err ? reject(err) : resolve({ stdout, stderr })));
    });
  }

  // cleanup package.txt
  fs.removeSync(options.targetDirectory + "/package.txt");
};

// Read package.txt for each optional package to configure package.json
const compileInstalls = async (dirArray: string[]) => {
  const npmCommands = [];
  for (const urlIndex in dirArray) {
    let lines = fs.readFileSync(dirArray[urlIndex] + "/package.txt", "utf8").replace("\n", "");
    if (userPkgManager === "pnpm") {
      lines = lines
        .replace(/npm/g, "pnpm")
        .replace(/--no-package-lock /g, "")
        .replace(/--package-lock-only/g, "--lockfile-only");
    } else if (userPkgManager === "yarn") {
      lines = lines
        .replace(/npm install/g, "yarn add")
        .replace(/--no-package-lock /g, "")
        .replace(/--package-lock-only/g, "--mode update-lockfile");
    }
    npmCommands.push(lines);
  }
  return npmCommands;
};

const configureDatabase = async (options: Options & { templateDirectory: string }) => {
  copyEnvFile(options);

  const operation = options.dbOperation == "Import Existing Schema" ? "pull" : "push";
  const basePath = options.templateDirectory.split("/templates")[0];
  const overwriteFolder = options.dbSolution.toLowerCase();
  const customOptions = {
    ...options,
    targetDirectory: options.targetDirectory,
    templateDirectory: basePath + "/overwrites/" + overwriteFolder,
  };

  const overwriteRequired = ["postgres", "mysql", "mongodb"]; //add DBs requiring overwrite here
  if (overwriteRequired.includes(overwriteFolder))
    //guard clause to only overwrite when needed (Postgres, mySQL, mongodb etc)
    await copyTemplateFiles(customOptions);

  const resultPull = await execa("npx", ["prisma", "db", operation], {
    cwd: options.targetDirectory,
  });
  if (operation == "pull") {
    const resultGenerate = await execa("npx", ["prisma", "generate"], {
      cwd: options.targetDirectory,
    });
    if (resultGenerate.failed) return Promise.reject(new Error("Failed to intialize DB via Prisma"));
  }
  if (resultPull.failed) {
    return Promise.reject(new Error("Failed to intialize DB via Prisma"));
  }
  return;
};

const copyEnvFile = (options: Options) => {
  const content = `DATABASE_URL="${options.dbString}"`;
  const file = options.targetDirectory + "/.env";
  fs.writeFile(file, content, (err) => {
    if (err) throw err;
    return;
  });
};

const initGit = async (options: Options) => {
  const result = await execa("git", ["init"], {
    cwd: options.targetDirectory,
  });

  if (!result.failed) return;

  console.log("Failed to init git");
  return Promise.reject(new Error("Failed to initialize git"));
};

export async function createT3SvelteApp(options: Options) {
  const templateBaseDir = path.resolve(__filename, "../../templates");
  const templateName = options.template.toLowerCase();
  let templateDir = "";

  if (templateName == "standard") templateDir = templateBaseDir + "/standard";
  else if (templateName == "custom: typescript") templateDir = templateBaseDir + "/base_typescript";
  else templateDir = templateBaseDir + "/base_javascript";

  try {
    await access(templateDir);
  } catch (err) {
    console.log(templateDir);
    console.error("%s Invalid template name", chalk.red.bold("ERROR"));
    process.exit(1);
  }

  const copyTemplateFileOptions = { templateDirectory: templateDir, ...options };

  const tasks = new Listr([
    {
      title: "Copy project files",
      task: () => copyTemplateFiles(copyTemplateFileOptions, templateName, templateBaseDir + "/"),
    },
    {
      title: "Initialize git",
      task: () => initGit(options),
      enabled: () => options.git,
    },
    {
      title: "Install dependencies",
      task: () => {
        projectInstall({
          prefer: userPkgManager as "npm" | "yarn",
          cwd: options.targetDirectory,
        });
      },
      enabled: () => options.runInstall,
    },
    {
      title: "Initialize DB",
      task: () => configureDatabase(copyTemplateFileOptions),
      enabled: () => options.db,
    },
  ]);

  await tasks.run();
  console.log("%s SvelteT3 is ready!", chalk.green.bold("DONE"));
  return true;
}
