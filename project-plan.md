# Music Discovery Tool - Project Plan

## Project Overview

A browser extension + web app ecosystem that transforms music discovery workflow from scattered tabs and forgotten lists into a centralized, organized system for finding and managing new music.

### Core Architecture

- **Browser Extension**: Data capture from RateYourMusic (extends existing rym-reader)
- **Web App**: Main dashboard for discovery management and playlist generation
- **Shared Database**: Centralized storage for discoveries, sources, and user states

---

## Epic 1: Core RateYourMusic Integration

### User Story 1.1: Capture Entire RateYourMusic Lists

**As a user**, I want to save entire RateYourMusic lists with one click so that I can review all albums later without keeping tabs open.

#### Acceptance Criteria:

- [ ] "Save entire list" button appears on RateYourMusic list pages
- [ ] Button captures: list URL, name, description, all albums/artists, author descriptions, tags
- [ ] Data is stored in shared database
- [ ] Success feedback is shown to user
- [ ] Works on all RateYourMusic list types

#### Technical Requirements:

- Extend existing rym-reader extension
- Inject button into RateYourMusic DOM
- Parse list metadata and entries
- API endpoint for saving list data
- Database schema for lists and entries

---

### User Story 1.2: Selectively Capture List Items

**As a user**, I want to select specific albums from RateYourMusic lists so that I only save items that interest me.

#### Acceptance Criteria:

- [ ] "Save selected items" button appears on RateYourMusic list pages
- [ ] Checkboxes appear next to each list entry when button is clicked
- [ ] Selected items are captured with same metadata as full list capture
- [ ] User can select/deselect all items with master checkbox
- [ ] Visual feedback shows selected items
- [ ] Save action only processes checked items

#### Technical Requirements:

- Dynamic checkbox injection
- Selection state management
- Selective data parsing
- Batch save API endpoint

---

### User Story 1.3: Capture Genre Charts

**As a user**, I want to save albums from RateYourMusic genre charts so that I can explore top albums in specific genres.

#### Acceptance Criteria:

- [ ] "Save entire chart" and "Save selected items" buttons appear on genre chart pages
- [ ] Captures chart metadata: genre, time period, ranking position
- [ ] Same selective capture functionality as lists
- [ ] Chart source is properly attributed in database
- [ ] Works across different chart time periods (yearly, all-time, etc.)

#### Technical Requirements:

- Chart page detection and parsing
- Genre and time period extraction
- Ranking position capture
- Chart-specific database schema

---

### User Story 1.4: Handle Duplicate Discoveries

**As a user**, I want duplicate albums from different sources to be merged so that I have a single entry with multiple source attributions.

#### Acceptance Criteria:

- [ ] Same album from multiple sources creates one database entry
- [ ] All sources are tracked in entry metadata
- [ ] User can see which sources led to discovery
- [ ] Duplicate detection works across lists and charts
- [ ] Artist + album name matching (with fuzzy matching for variations)

#### Technical Requirements:

- Duplicate detection algorithm
- Source attribution system
- Database normalization
- Fuzzy string matching for album/artist names

---

## Epic 2: Discovery Management Dashboard

### User Story 2.1: Central Discovery Landing Page

**As a user**, I want a single dashboard showing all my music discoveries so that I can easily browse and manage them.

#### Acceptance Criteria:

- [ ] Clean, simple interface showing all discoveries
- [ ] Each entry shows: album/artist, source(s), genre, description
- [ ] Pagination or infinite scroll for large collections
- [ ] Quick visual distinction between listened/unlistened items
- [ ] Responsive design for different screen sizes

#### Technical Requirements:

- React/Vue web application
- API endpoints for discovery retrieval
- Pagination implementation
- CSS framework for clean design

---

### User Story 2.2: Filter and Organize Discoveries

**As a user**, I want to filter my discoveries by genre, source, and date so that I can find specific types of music to explore.

#### Acceptance Criteria:

- [ ] Filter by genre (multi-select)
- [ ] Filter by source type (RYM lists, genre charts, etc.)
- [ ] Filter by specific source (individual lists/charts)
- [ ] Filter by date discovered
- [ ] Filter by listened/unlistened status
- [ ] Filters can be combined
- [ ] Filter state persists during session
- [ ] Clear all filters option

#### Technical Requirements:

- Advanced filtering UI components
- Query parameter management
- Database indexing for performance
- Filter state management

---

### User Story 2.3: Mark Discovery Status

**As a user**, I want to mark discoveries as "listened to" or "want to check out" so that I can track my progress and find new music to explore.

#### Acceptance Criteria:

- [ ] Toggle buttons for listened/unlistened status
- [ ] Visual indicators for each status
- [ ] Quick filter to show only unlistened items
- [ ] Status changes are immediately saved
- [ ] Bulk status update capabilities
- [ ] Default status is "want to check out"

#### Technical Requirements:

- Status field in database
- Real-time UI updates
- Bulk update API endpoints
- Optimistic UI updates

---

### User Story 2.4: Quick Actions for Discoveries

**As a user**, I want quick access to play, save, and manage my discoveries so that I can easily transition from discovery to listening.

#### Acceptance Criteria:

- [ ] "Open in Spotify" button (if available)
- [ ] "Open in YouTube" button
- [ ] "Add to playlist" dropdown with existing playlists
- [ ] "Remove from discoveries" option
- [ ] Actions work from discovery cards
- [ ] External links open in new tabs
- [ ] Graceful handling when services are unavailable

#### Technical Requirements:

- Spotify Web API integration
- YouTube search API integration
- Playlist management system
- External link handling
- Error handling and fallbacks

---

## Epic 3: Playlist Generation System

### User Story 3.1: Album-Based Playlist Generation

**As a user**, I want to generate playlists from my discoveries so that I can easily listen to new music without manual curation.

#### Acceptance Criteria:

- [ ] "Generate Playlist" feature in main interface
- [ ] Configurable number of albums (default: 10)
- [ ] Album-based selection (not individual tracks)
- [ ] Multiple sourcing options: by genre, by source, random
- [ ] Preview generated playlist before saving
- [ ] Regenerate option if unsatisfied with selection
- [ ] Save to Spotify option

#### Technical Requirements:

- Playlist generation algorithms
- Spotify playlist creation API
- Configuration UI
- Preview interface
- Random selection with weighting options

---

### User Story 3.2: Smart Playlist Curation

**As a user**, I want playlist generation to be intelligent about variety and discovery patterns so that playlists are engaging and diverse.

#### Acceptance Criteria:

- [ ] Avoid recently listened albums in generation
- [ ] Genre diversity options (mixed vs focused)
- [ ] Source diversity (don't pull everything from one list)
- [ ] Configurable weighting for different sources
- [ ] Option to include only unlistened discoveries
- [ ] Save generation preferences

#### Technical Requirements:

- Smart filtering algorithms
- User preference storage
- Diversity calculation logic
- Historical listening data integration

---

## Epic 4: Newsletter/Blog Integration

### User Story 4.1: Multi-Panel Blog Browsing

**As a user**, I want to browse multiple music blogs side-by-side so that I can efficiently consume content from various sources.

#### Acceptance Criteria:

- [ ] Panel-based interface using DockView or similar
- [ ] Add/remove panels dynamically
- [ ] Resize and rearrange panels
- [ ] Embedded iframe browsing
- [ ] Panel state persistence
- [ ] Bookmarkable panel configurations

#### Technical Requirements:

- DockView or similar panel library integration
- iframe security and sandboxing
- Panel state management
- Local storage for configurations

---

### User Story 4.2: Article Content Extraction

**As a user**, I want to capture music recommendations from blog articles so that they integrate with my discovery workflow.

#### Acceptance Criteria:

- [ ] "Extract music" button on blog panels
- [ ] Automatic parsing of artist/album mentions
- [ ] Manual selection of extracted items
- [ ] Integration with main discovery database
- [ ] Source attribution to original article
- [ ] Handle various blog formats and structures

#### Technical Requirements:

- Natural language processing for music entity extraction
- Content scraping and parsing
- Manual selection interface
- Integration with existing database schema

---

## Epic 5: Enhanced Features & Polish

### User Story 5.1: Search and Discovery Enhancement

**As a user**, I want to search through my discoveries and get smart suggestions so that I can quickly find what I'm looking for.

#### Acceptance Criteria:

- [ ] Full-text search across all discovery metadata
- [ ] Search suggestions based on typing
- [ ] Search by artist, album, genre, source, description
- [ ] Recent searches saved
- [ ] Search result highlighting
- [ ] Advanced search operators

#### Technical Requirements:

- Full-text search implementation (Elasticsearch or similar)
- Search suggestion engine
- Query parsing and highlighting
- Search history storage

---

### User Story 5.2: Data Export and Backup

**As a user**, I want to export my discovery data so that I can backup my collection and use it elsewhere.

#### Acceptance Criteria:

- [ ] Export all discoveries to JSON/CSV
- [ ] Export filtered subsets
- [ ] Import data from backups
- [ ] Spotify playlist export
- [ ] Data format documentation
- [ ] Scheduled backup options

#### Technical Requirements:

- Data serialization formats
- Export/import API endpoints
- File download handling
- Data validation on import

---

## Technical Architecture

### Database Schema

```sql
-- Core entities
discoveries (id, artist, album, genre, description, status, created_at, updated_at)
sources (id, type, name, url, description, metadata)
discovery_sources (discovery_id, source_id, context)

-- User management
playlists (id, name, description, created_at)
playlist_items (playlist_id, discovery_id, position)

-- Blog integration
articles (id, url, title, content, extracted_music, created_at)
```

### API Endpoints

```
GET /api/discoveries - List discoveries with filtering
POST /api/discoveries - Create new discovery
PUT /api/discoveries/:id - Update discovery status
DELETE /api/discoveries/:id - Remove discovery

GET /api/sources - List sources
POST /api/sources - Create new source

POST /api/playlists/generate - Generate new playlist
GET /api/playlists - List user playlists
POST /api/playlists - Create playlist

POST /api/articles/extract - Extract music from article
```

### Browser Extension Architecture

- Content script injection for RateYourMusic pages
- Background script for API communication
- Popup interface for quick actions
- Storage sync with web app database

---

## Implementation Phases

### Phase 1: Foundation

- Extend existing rym-reader extension with list capture
- Basic web app with discovery listing
- Database setup and core API endpoints
- Simple status management

### Phase 2: Core Features

- Advanced filtering and organization
- Quick actions (Spotify, YouTube integration)
- Basic playlist generation
- Duplicate handling

### Phase 3: Enhanced Discovery

- Smart playlist curation
- Search functionality
- Multi-panel blog browsing
- Article content extraction

### Phase 4: Polish & Expansion

- Performance optimization
- Enhanced UI/UX
- Data export/import
- Future integration preparation (Bandcamp, etc.)

---

## Success Metrics

- Number of discoveries captured per week
- Percentage of discoveries marked as "listened to"
- Playlist generation usage frequency
- User session time on discovery dashboard
- Reduction in open browser tabs during music discovery
