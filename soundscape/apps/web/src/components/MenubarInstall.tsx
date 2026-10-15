import { Show, type Component } from 'solid-js';
import ExternalLink from './ExternalLink';
import { resolveApiUrl } from '../lib/trpc';

const downloadUrl =
  'https://github.com/epleaner/music-discovery-tools/releases/download/latest/RYM-MenuBar.zip';

const MenubarInstall: Component = () => {
  const server = new URL(`${resolveApiUrl(import.meta.env?.VITE_API_URL)}/ws`);
  server.protocol = server.protocol === 'https:' ? 'wss:' : 'ws:';
  const customServer = ![
    'ws://localhost:3001/ws',
    'ws://127.0.0.1:3001/ws',
    'ws://[::1]:3001/ws',
  ].includes(server.href);
  const launchCommand = `SCRAPE_AGENT_WS_URL='${server.href.replaceAll("'", "'\\''")}' '/Applications/RYM MenuBar.app/Contents/MacOS/RYMMenuBar'`;

  return (
    <section class="control-group" aria-label="Install the menu-bar app">
      <div class="form-actions">
        <ExternalLink href={downloadUrl} class="btn btn-secondary">
          Download menu-bar app
        </ExternalLink>
      </div>
      <p class="meta-text">
        macOS 11+ · Google Chrome · GitHub sign-in and repository access
        required
      </p>
      <details class="control-group">
        <summary class="link">Installation steps</summary>
        <ol class="form-stack meta-text list-decimal pl-5">
          <li>Unzip RYM-MenuBar.zip. Move RYM MenuBar.app to Applications.</li>
          <li>
            Open RYM MenuBar.app. Look for ≡★ in the menu bar, not the Dock.
            <p class="meta-text">
              This build is not notarized. If macOS blocks it, review{' '}
              <ExternalLink href="https://support.apple.com/en-us/102445">
                Apple’s security guidance
              </ExternalLink>{' '}
              before deciding whether to open it.
            </p>
            <Show when={customServer}>
              <div class="control-group">
                <p>
                  To connect to this server, quit the app and run in Terminal:
                </p>
                <code class="code-value">{launchCommand}</code>
                <p>Keep Terminal open while using the helper.</p>
              </div>
            </Show>
          </li>
          <li>
            Click ≡★, then “No debug Chrome — click to start” if shown. Log into
            RateYourMusic in that Chrome window.
          </li>
          <li>
            Choose “Pair with Soundscape Web…”. Paste the passphrase you use
            here and confirm. Or choose “Copy for Soundscape Web” and enter the
            app’s passphrase here. Use the same passphrase in both.
          </li>
          <li>
            Open Account → Browser helper here. Wait for Connected, then use
            Scrape. Keep the app and its Chrome window running.
          </li>
        </ol>
      </details>
    </section>
  );
};

export default MenubarInstall;
