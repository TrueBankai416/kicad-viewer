/**
 * SPDX-FileCopyrightText: WARP <development@warp.lv>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import {v4 as uuidv4} from 'uuid';
import {generateFilePath} from '@nextcloud/router';
import {APP_ID} from 'configuration/config.mjs'; // eslint-disable-line import/no-unresolved, n/no-missing-import
import {fetchFileFromUrl} from 'helpers/warp-helpers.mjs'; // eslint-disable-line import/no-unresolved, n/no-missing-import
import logger from 'logger/logger.mjs'; // eslint-disable-line import/no-unresolved, n/no-missing-import

// Create enhanced logger that ensures console output
const enhancedLogger = {
  debug: (...args) => {
    console.debug('[KiCAD Viewer]', ...args);
    logger.debug?.(...args);
  },
  info: (...args) => {
    console.info('[KiCAD Viewer]', ...args);
    logger.info?.(...args);
  },
  warn: (...args) => {
    console.warn('[KiCAD Viewer]', ...args);
    logger.warn?.(...args);
  },
  error: (...args) => {
    console.error('[KiCAD Viewer]', ...args);
    logger.error?.(...args);
  }
};

// Check if debug mode is enabled via URL parameter
const isDebugMode = () => {
  return window.location.href.includes('kicad_debug=true') ||
         localStorage.getItem('kicad_viewer_debug') === 'true';
};

// Enable debug mode if requested
if (isDebugMode()) {
  enhancedLogger.info('Debug mode enabled for KiCAD Viewer');
}

// ----------------

export default {
  name: 'App',
  data () {
    return {
      uuid: `uuid-${uuidv4()}`,
      isLoading: true,
      appIconUrl: generateFilePath(APP_ID, '', 'img/app.svg'),
      kicanvasEmbed: null,
    };
  },
  mounted () {
    this.$nextTick(() => {
      enhancedLogger.info('KiCAD Viewer mounted');
      this.construct();
    });
  },
  beforeDestroy () {
    enhancedLogger.debug('Destroying KiCAD Viewer component');
    this.destruct();
  },
  methods: {
    destruct () {
      // Clean up kicanvas embed
      if (this.kicanvasEmbed) {
        try {
          // Remove source elements
          while (this.kicanvasEmbed.firstChild) {
            this.kicanvasEmbed.removeChild(
              this.kicanvasEmbed.firstChild,
            );
          }
        } catch (error) {
          enhancedLogger.debug('Error cleaning up KiCanvas:', error);
        }
        this.kicanvasEmbed = null;
      }
    },
    async construct () {
      this.isLoading = true;
      enhancedLogger.info('Constructing KiCAD Viewer');

      try {
        // Get the KiCad file to display
        const fileFetchUrl = this.source || this.davPath;
        const fileBasename = this.basename;
        const fileExtension = fileBasename.split('.').pop().toLowerCase();

        enhancedLogger.debug('Loading file:', fileFetchUrl);
        enhancedLogger.debug('File type detected:', fileExtension);

        // Fetch the file content
        const fileContent = await this.fetchKiCadFile(
          fileFetchUrl,
          fileBasename,
        );

        this.isLoading = false;
        enhancedLogger.debug('File content loaded, length:', fileContent.length);

        // Initialize KiCanvas after the DOM is updated and loading is done
        this.$nextTick(() => {
          this.initKiCanvas(fileContent, fileExtension);
        });
      }
      catch (error) {
        enhancedLogger.error('Error loading KiCad file:', error);
        this.isLoading = false;
      }
    },
    initKiCanvas(fileContent, fileExtension) {
      try {
        enhancedLogger.debug('Initializing KiCanvas');
        const container = this.$el.querySelector(
          `.${this.$style.containCanvas}`,
        );
        this.kicanvasEmbed = container.querySelector('kicanvas-embed');

        if (!this.kicanvasEmbed) {
          enhancedLogger.error('KiCanvas embed element not found');
          return;
        }

        // Clear any existing sources
        while (this.kicanvasEmbed.firstChild) {
          this.kicanvasEmbed.removeChild(this.kicanvasEmbed.firstChild);
        }

        // Create source element with proper file type
        const sourceElement = document.createElement('kicanvas-source');
        sourceElement.setAttribute('name', this.basename);
        sourceElement.setAttribute('type', this.getKiCadMimeType(fileExtension));

        // Load content safely with error boundary
        try {
          this.loadContentIntoKiCanvas(sourceElement, fileContent, fileExtension);
        } catch (err) {
          enhancedLogger.error('Error in loadContentIntoKiCanvas:', err);
        }

        // Add the source to the embed element
        this.kicanvasEmbed.appendChild(sourceElement);

        // Force KiCanvas to refresh/render
        try {
          if (typeof this.kicanvasEmbed.refresh === 'function') {
            this.kicanvasEmbed.refresh();
            enhancedLogger.debug('Called refresh() on kicanvas-embed');
          }
        } catch (err) {
          enhancedLogger.debug('Refresh not available:', err.message);
        }

        enhancedLogger.info('KiCanvas initialized successfully');
      } catch (error) {
        enhancedLogger.error('Error initializing KiCanvas:', error);
      }
    },
    getKiCadMimeType(extension) {
      // Map KiCad file extensions to appropriate mime types
      const mimeMap = {
        'kicad_pcb': 'application/x-kicad-pcb',
        'kicad_sch': 'application/x-kicad-schematic',
        'kicad_pro': 'application/x-kicad-project',
        'kicad_wks': 'application/x-kicad-workspace',
        'kicad_mod': 'application/x-kicad-footprint',
        'kicad_sym': 'application/x-kicad-symbol'
      };

      return mimeMap[extension] || 'text/plain';
    },
    loadContentIntoKiCanvas(sourceElement, fileContent, fileExtension) {
      // We'll still try multiple approaches, but in a more robust way
      let loadSuccess = false;

      // Approach 1: Direct content setting
      if (!loadSuccess) {
        try {
          enhancedLogger.debug('Trying to set content directly');
          if (typeof sourceElement.setContent === 'function') {
            sourceElement.setContent(fileContent);
            enhancedLogger.debug('Direct content setting successful');
            loadSuccess = true;
          }
        } catch (err) {
          enhancedLogger.debug('Direct content setting failed:', err.message);
        }
      }

      // Approach 2: Data URL with proper mime type
      if (!loadSuccess) {
        try {
          enhancedLogger.debug('Trying data URL approach');
          // Get appropriate mime type for this file extension
          const mimeType = this.getKiCadMimeType(fileExtension);

          // Convert to base64 - handle Unicode correctly
          const base64Content = btoa(unescape(encodeURIComponent(fileContent)));
          const dataUrl = `data:${mimeType};base64,${base64Content}`;

          // Set source attribute
          sourceElement.setAttribute('src', dataUrl);
          sourceElement.setAttribute('data-format', fileExtension);
          enhancedLogger.debug('Data URL approach successful with mime type:', mimeType);
          loadSuccess = true;
        } catch (err) {
          enhancedLogger.warn('Data URL approach failed:', err.message);
        }
      }

      // Approach 3: Blob URL
      if (!loadSuccess && !window.kiCanvasBlobUrlsNotSupported) {
        try {
          enhancedLogger.debug('Trying blob URL approach');

          // Create blob with proper mime type
          const mimeType = this.getKiCadMimeType(fileExtension);
          const blob = new Blob([fileContent], { type: mimeType });

          const fileUrl = URL.createObjectURL(blob);
          enhancedLogger.debug('Created Blob URL for file content with mime type:', mimeType);

          // Set source attribute
          sourceElement.setAttribute('src', fileUrl);
          sourceElement.setAttribute('data-format', fileExtension);

          // Clean up the URL
          window.setTimeout(() => {
            try {
              URL.revokeObjectURL(fileUrl);
            } catch (e) {
              // Ignore revocation errors
            }
          }, 30000);

          loadSuccess = true;
        } catch (err) {
          enhancedLogger.warn('Blob URL approach failed:', err.message);
          window.kiCanvasBlobUrlsNotSupported = true;
        }
      }

      // Last resort: Set raw content
      if (!loadSuccess) {
        try {
          enhancedLogger.debug('Falling back to setting raw content directly');
          sourceElement.textContent = fileContent;
          sourceElement.setAttribute('data-format', fileExtension);
          enhancedLogger.debug('Set raw content with data-format:', fileExtension);
          loadSuccess = true;
        } catch (err) {
          enhancedLogger.error('All content loading approaches failed');
        }
      }

      return loadSuccess;
    },
    async fetchKiCadFile (url, filename) {
      try {
        enhancedLogger.debug('Fetching KiCad file from URL:', url);

        // Try a direct fetch first for maximum compatibility
        try {
          const response = await fetch(url);
          if (response.ok) {
            const text = await response.text();
            enhancedLogger.debug('File fetched successfully via fetch API');
            return text;
          }
        } catch (err) {
          enhancedLogger.debug('Direct fetch failed, falling back to fetchFileFromUrl:', err);
        }

        // Fall back to helper method
        const file = await fetchFileFromUrl(url, filename);
        enhancedLogger.debug('File fetched successfully via helper');
        return await file.text();
      } catch (error) {
        enhancedLogger.error('Error fetching KiCad file:', error);
        throw error;
      }
    }
  }
};
