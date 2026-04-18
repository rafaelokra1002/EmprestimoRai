const nextJest = require("next/jest.js")

const createJestConfig = nextJest({ dir: "./" })

/** @type {import('jest').Config} */
const config = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/.next/",
    "__mocks__",
  ],
}

module.exports = createJestConfig(config)
