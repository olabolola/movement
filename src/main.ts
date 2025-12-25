import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (_evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, _view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a command to find and log all notes with ISBN property
		this.addCommand({
			id: 'log-notes-with-isbn',
			name: 'Log notes with ISBN',
			callback: async () => {
				const files = this.app.vault.getMarkdownFiles();
				const allMovies: Array<{title: string, date: string, file: any, cache: any}> = [];

				files.forEach(file => {
					const cache = this.app.metadataCache.getFileCache(file);
					if (cache?.frontmatter?.isbn) {
						const title = file.basename;
						const dates = cache.frontmatter.dates;
						const dateStr = Array.isArray(dates) ? dates[0] : (dates || '');
						allMovies.push({title, date: dateStr, file, cache});
					}
				});

				// Find the list of all movies file
				const listFile = this.app.vault.getMarkdownFiles().find(f => f.basename === 'list of all movies');
				if (!listFile) {
					new Notice('Could not find "list of all movies" file');
					return;
				}

				// Read the file content
				let content = await this.app.vault.read(listFile);

				// Find the grid codeblock
				const gridBlockRegex = /```grid\n([\s\S]*?)```/;
				const match = content.match(gridBlockRegex);

				if (!match) {
					new Notice('Could not find grid codeblock in file');
					return;
				}

				const existingContent = match[1];
				const existingMovies = new Set(
					existingContent.split('\n')
						.filter(line => line.trim())
						.map(line => line.split(',')[0])
				);

				// Find movies not already in the grid
				const newMovies = allMovies.filter(m => !existingMovies.has(m.title));

				if (newMovies.length === 0) {
					new Notice('All movies already in grid');
					return;
				}

				// Move posters for new movies
				const postersDestDir = 'olabola-site/content/posters';
				let movedCount = 0;
				const movieGridData: Array<{title: string, poster: string, date: string}> = [];

				for (const movie of newMovies) {
					const posterPath = movie.cache.frontmatter?.poster;
					let finalPosterPath = '';

					if (posterPath) {
						const posterFile = this.app.vault.getAbstractFileByPath(posterPath);
						if (posterFile && !(posterFile instanceof this.app.vault.adapter.constructor)) {
							const fileName = posterPath.split('/').pop();
							const destPath = `${postersDestDir}/${fileName}`;

							// Check if destination already exists
							const destExists = await this.app.vault.adapter.exists(destPath);
							if (!destExists) {
								// Ensure destination directory exists
								const destDir = destPath.substring(0, destPath.lastIndexOf('/'));
								await this.app.vault.adapter.mkdir(destDir);

								// Move the file
								await this.app.vault.rename(posterFile, destPath);
								movedCount++;

								// Update frontmatter in the movie note
								const noteContent = await this.app.vault.read(movie.file);
								const updatedNote = noteContent.replace(
									new RegExp(`poster: ${posterPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
									`poster: ${destPath}`
								);
								await this.app.vault.modify(movie.file, updatedNote);
							}
							finalPosterPath = `posters/${fileName}`;
						}
					}

					movieGridData.push({
						title: movie.title,
						poster: finalPosterPath,
						date: movie.date
					});
				}

				// Build new content
				const newLines = movieGridData.map(m => `${m.title},${m.poster},${m.date}`).join('\n');
				const updatedGridContent = existingContent.trim() + '\n' + newLines;
				const updatedContent = content.replace(gridBlockRegex, `\`\`\`grid\n${updatedGridContent}\n\`\`\``);

				// Write back to file
				await this.app.vault.modify(listFile, updatedContent);
				new Notice(`Added ${newMovies.length} movies to grid, moved ${movedCount} posters`);
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}

