import { DiscoveryEntry, DiscoveryFileSystem } from "../discovery/DiscoveryFileSystem";
import { DiscoveryEnvironment } from "../discovery/DiscoveryEnvironment";

/**
 * In-memory host adapters for the discovery tests: a file system rooted at `/` with
 * '/'-separated paths, and a fixed environment. Shared by `discovery.test.ts` and the
 * conformance kit runner.
 */
export class MemoryFileSystem implements DiscoveryFileSystem {
	private readonly files: Map<string, string>;
	private readonly dirs: Set<string> = new Set(["/"]);

	constructor(files: Record<string, string>) {
		this.files = new Map(Object.entries(files));

		// Every ancestor of a file is a directory.
		for (const file of this.files.keys()) {
			let dir = this.dirname(file);
			while (dir !== null) {
				this.dirs.add(dir);
				dir = this.parentOf(dir);
			}
		}
	}

	/** Registers a directory that contains no files. */
	addEmptyDir(path: string): void {
		let dir: string | null = path;
		while (dir !== null) {
			this.dirs.add(dir);
			dir = this.parentOf(dir);
		}
	}

	async isDirectory(path: string): Promise<boolean> {
		return this.dirs.has(path);
	}

	async listDirectory(path: string): Promise<DiscoveryEntry[]> {
		const prefix = path === "/" ? "/" : path + "/";
		const names = new Set<string>();
		const entries: DiscoveryEntry[] = [];

		for (const candidate of [...this.files.keys(), ...this.dirs]) {
			if (candidate !== path && candidate.startsWith(prefix)) {
				const name = candidate.substring(prefix.length).split("/")[0];

				if (!names.has(name)) {
					names.add(name);
					const full = prefix + name;
					entries.push({ path: full, name, isDirectory: this.dirs.has(full) });
				}
			}
		}

		return entries;
	}

	async readFile(path: string): Promise<string> {
		const content = this.files.get(path);

		if (content === undefined) {
			throw new Error(`File not found: ${path}`);
		}

		return content;
	}

	parentOf(path: string): string | null {
		return this.dirname(path);
	}

	join(path: string, name: string): string {
		return path === "/" ? "/" + name : path + "/" + name;
	}

	private dirname(path: string): string | null {
		if (path === "/") {
			return null;
		}

		const index = path.lastIndexOf("/");
		return index === 0 ? "/" : path.substring(0, index);
	}
}

/** Configurable DiscoveryEnvironment for the tests. */
export class TestEnvironment implements DiscoveryEnvironment {
	constructor(
		private readonly stxtPath: string[] | null = null,
		private readonly userDir: string | null = null,
		private readonly systemDir: string | null = null
	) {}

	getStxtPath(): string[] | null { return this.stxtPath; }
	getUserLevelDir(): string | null { return this.userDir; }
	getSystemLevelDir(): string | null { return this.systemDir; }
}

