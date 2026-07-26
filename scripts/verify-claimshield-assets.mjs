import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDir, "..");
const contractArtifacts = path.join(
  repositoryRoot,
  "pkgs/contract/src/managed/claimshield",
);
const publicArtifacts = path.join(
  repositoryRoot,
  "pkgs/app/public/managed/claimshield",
);
const artifactDirectories = ["keys", "zkir"];

const listFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return listFiles(entryPath).map((file) => path.join(entry.name, file));
      }

      return entry.isFile() ? [entry.name] : [];
    })
    .sort();

for (const artifactDirectory of artifactDirectories) {
  const sourceDirectory = path.join(contractArtifacts, artifactDirectory);
  const publicDirectory = path.join(publicArtifacts, artifactDirectory);
  const sourceFiles = listFiles(sourceDirectory);
  const publicFiles = listFiles(publicDirectory);

  if (sourceFiles.length === 0) {
    throw new Error(
      `No generated ClaimShield ${artifactDirectory} assets found.`,
    );
  }

  if (JSON.stringify(sourceFiles) !== JSON.stringify(publicFiles)) {
    throw new Error(
      `ClaimShield ${artifactDirectory} assets are not synchronized with the contract output.`,
    );
  }

  for (const file of sourceFiles) {
    const source = readFileSync(path.join(sourceDirectory, file));
    const destination = readFileSync(path.join(publicDirectory, file));

    if (!source.equals(destination)) {
      throw new Error(
        `ClaimShield public asset differs from contract output: ${file}`,
      );
    }
  }
}

console.log("ClaimShield public ZK assets are synchronized.");
