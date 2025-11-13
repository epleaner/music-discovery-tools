import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';

interface Genre {
  name: string;
  description: string;
  URL: string;
  subgenres: Genre[];
}

function extractSubgenres(
  $: cheerio.CheerioAPI,
  $list: cheerio.Cheerio<cheerio.Element>
): Genre[] {
  const subgenres: Genre[] = [];

  // Process each hierarchy_list_item in this list
  // Use children() to get direct children only, avoiding nested items
  $list.children('li.hierarchy_list_item').each((_, itemElement) => {
    const $item = $(itemElement);
    const $details = $item.children('.hierarchy_list_item_details').first();

    if ($details.length === 0) return;

    const $link = $details.find('a').first();
    const $description = $details.find('p').first();

    if ($link.length === 0) return;

    const name = $link.text().trim();
    const url = $link.attr('href') || '';
    const description = $description.text().trim().replace(/\s+/g, ' ') || '';

    // Find nested subgenres: look for ul.hierarchy_list that are direct children
    // of this hierarchy_list_item (after the details div)
    const nestedSubgenres: Genre[] = [];
    $item.children('ul.hierarchy_list').each((_, nestedList) => {
      const nested = extractSubgenres($, $(nestedList));
      nestedSubgenres.push(...nested);
    });

    subgenres.push({
      name,
      description,
      URL: url,
      subgenres: nestedSubgenres,
    });
  });

  return subgenres;
}

function extractGenreFromItem(
  $: cheerio.CheerioAPI,
  $item: cheerio.Cheerio<cheerio.Element>
): Genre | null {
  // Extract main genre info
  const $mainInner = $item.find('.page_genre_index_hierarchy_item_main_inner');
  const $titleLink = $mainInner.find('h2 > a').first();
  const $description = $mainInner.find('.page_genre_index_hierarchy_item_description').first();

  if ($titleLink.length === 0) return null;

  const name = $titleLink.text().trim();
  const url = $titleLink.attr('href') || '';
  const description = $description.text().trim().replace(/\s+/g, ' ') || '';

  // Find the expanded section for subgenres
  const $expanded = $item.find('.page_genre_index_hierarchy_item_expanded');
  const subgenres: Genre[] = [];
  
  if ($expanded.length > 0) {
    // Find all top-level hierarchy_list elements in the expanded section
    // These are direct children of the expanded div
    $expanded.children('ul.hierarchy_list').each((_, listElement) => {
      const nested = extractSubgenres($, $(listElement));
      subgenres.push(...nested);
    });
  }

  return {
    name,
    description,
    URL: url,
    subgenres,
  };
}

function scrapeGenres(htmlPath: string): { genres: Genre[] } {
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const $ = cheerio.load(html);
  const genres: Genre[] = [];

  // Find all main genre items in the main hierarchy (direct children of ul)
  $('ul.page_genre_index_hierarchy > li.page_genre_index_hierarchy_item').each((_, element) => {
    const genre = extractGenreFromItem($, $(element));
    if (genre) {
      genres.push(genre);
    }
  });

  // Find uncategorized genres - they have the parentless_non_top_level class
  $('li.page_genre_index_hierarchy_item.parentless_non_top_level').each((_, element) => {
    const genre = extractGenreFromItem($, $(element));
    if (genre) {
      genres.push(genre);
    }
  });

  return { genres };
}

// Main execution
const workspaceRoot = process.cwd();
const htmlPath = process.argv[2] || '/Users/eli.pleaner/Downloads/Music Genres - Rate Your Music.html';
const outputPath = process.argv[3] || path.join(workspaceRoot, 'static/rym-genres.json');

if (!fs.existsSync(htmlPath)) {
  console.error(`Error: HTML file not found at ${htmlPath}`);
  process.exit(1);
}

console.log(`Reading HTML from: ${htmlPath}`);
const result = scrapeGenres(htmlPath);

const countAllGenres = (g: Genre): number => {
  return 1 + g.subgenres.reduce((sum, sg) => sum + countAllGenres(sg), 0);
};

const totalGenres = result.genres.reduce((acc, genre) => acc + countAllGenres(genre), 0);
const mainGenres = result.genres.length;

console.log(`Found ${mainGenres} main genres`);
console.log(`Total genres + subgenres: ${totalGenres}`);

// Ensure output directory exists
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
console.log(`Output written to: ${outputPath}`);

