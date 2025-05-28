/**
 * SPDX-FileCopyrightText: WARP <development@warp.lv>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import {v4 as uuidv4} from 'uuid';
import {generateFilePath} from '@nextcloud/router';
import {APP_ID} from 'configuration/config.mjs';
import {fetchFileFromUrl} from 'helpers/warp-helpers.mjs';
import logger from 'logger/logger.mjs';

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
      enhancedLogger.info('=== Starting KiCanvas initialization ===');
      
      try {
        // Find the container
        const container = this.$el.querySelector(`.${this.$style.containCanvas}`);
        if (!container) {
          enhancedLogger.error('Canvas container not found');
          return;
        }
        enhancedLogger.debug('Canvas container found');

        // Find or create the kicanvas-embed element
        this.kicanvasEmbed = container.querySelector('kicanvas-embed');
        if (!this.kicanvasEmbed) {
          enhancedLogger.error('KiCanvas embed element not found in container');
          return;
        }
        enhancedLogger.debug('Found kicanvas-embed element');

        // Instead of manipulating children, recreate the entire embed element
        // This avoids any DOM operation issues with the custom element
        const parent = this.kicanvasEmbed.parentNode;
        const newEmbed = document.createElement('kicanvas-embed');
        
        // Copy any important attributes from the old embed
        if (this.kicanvasEmbed.hasAttributes()) {
          for (let attr of this.kicanvasEmbed.attributes) {
            try {
              newEmbed.setAttribute(attr.name, attr.value);
            } catch (e) {
              enhancedLogger.debug('Could not copy attribute:', attr.name);
            }
          }
        }

        // Replace the old embed with the new one
        try {
          parent.replaceChild(newEmbed, this.kicanvasEmbed);
          this.kicanvasEmbed = newEmbed;
          enhancedLogger.debug('Successfully replaced kicanvas-embed element');
        } catch (err) {
          enhancedLogger.warn('Could not replace embed element, continuing with original:', err.message);
        }

        // Set the file content directly on the kicanvas-embed element
        try {
          enhancedLogger.debug('Setting file content directly on kicanvas-embed');
          
          // Create blob URL from file content
          const mimeType = this.getKiCadMimeType(fileExtension);
          const blob = new Blob([fileContent], { type: mimeType });
          const fileUrl = URL.createObjectURL(blob);
          
          enhancedLogger.debug('Created blob URL for KiCanvas:', {
            url: fileUrl,
            mimeType: mimeType,
            fileSize: fileContent.length,
            filename: this.basename
          });
          
          // Set the src attribute directly on kicanvas-embed (this is the correct way)
          this.kicanvasEmbed.setAttribute('src', fileUrl);
          this.kicanvasEmbed.setAttribute('controls', 'basic');
          
          enhancedLogger.debug('Set src attribute on kicanvas-embed successfully');
          
          // Clean up the URL after KiCanvas has loaded it
          setTimeout(() => {
            try {
              URL.revokeObjectURL(fileUrl);
              enhancedLogger.debug('Cleaned up blob URL');
            } catch (e) {
              // Ignore cleanup errors
            }
          }, 30000);
          
        } catch (err) {
          enhancedLogger.error('Failed to set content on kicanvas-embed:', err);
          return;
        }

        // Try to trigger any refresh/update methods
        this.refreshKiCanvas();

        enhancedLogger.info('=== KiCanvas initialization completed successfully ===');
      } catch (error) {
        enhancedLogger.error('=== KiCanvas initialization failed ===', error);
      }
    },
    
    
    refreshKiCanvas() {
      try {
        // Try multiple ways to refresh/update the canvas
        if (this.kicanvasEmbed) {
          if (typeof this.kicanvasEmbed.refresh === 'function') {
            this.kicanvasEmbed.refresh();
            enhancedLogger.debug('Called refresh() method');
          } else if (typeof this.kicanvasEmbed.update === 'function') {
            this.kicanvasEmbed.update();
            enhancedLogger.debug('Called update() method');
          } else if (typeof this.kicanvasEmbed.render === 'function') {
            this.kicanvasEmbed.render();
            enhancedLogger.debug('Called render() method');
          } else {
            enhancedLogger.debug('No refresh methods available');
          }
        }
      } catch (error) {
        enhancedLogger.debug('Refresh failed (not critical):', error.message);
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
      
      enhancedLogger.debug('Starting loadContentIntoKiCanvas with file extension:', fileExtension);
      enhancedLogger.debug('File content length:', fileContent.length);

      // Approach 1: Direct content setting
      if (!loadSuccess) {
        try {
          enhancedLogger.debug('Trying to set content directly');
          if (typeof sourceElement.setContent === 'function') {
            sourceElement.setContent(fileContent);
            enhancedLogger.debug('Direct content setting successful');
            loadSuccess = true;
          } else {
            enhancedLogger.debug('setContent method not available');
          }
        } catch (err) {
          enhancedLogger.debug('Direct content setting failed:', err.message, err);
        }
      }

      // Approach 2: Simple text content (try this before complex encoding)
      if (!loadSuccess) {
        try {
          enhancedLogger.debug('Trying simple text content approach');
          sourceElement.textContent = fileContent;
          sourceElement.setAttribute('data-format', fileExtension);
          enhancedLogger.debug('Simple text content approach successful');
          loadSuccess = true;
        } catch (err) {
          enhancedLogger.debug('Simple text content approach failed:', err.message, err);
        }
      }

      // Approach 3: Blob URL (safer than data URL for large content)
      if (!loadSuccess && !window.kiCanvasBlobUrlsNotSupported) {
        try {
          enhancedLogger.debug('Trying blob URL approach');

          // Create blob with proper mime type
          const mimeType = this.getKiCadMimeType(fileExtension);
          enhancedLogger.debug('Creating blob with mime type:', mimeType);
          
          const blob = new Blob([fileContent], { type: mimeType });
          enhancedLogger.debug('Blob created successfully, size:', blob.size);

          const fileUrl = URL.createObjectURL(blob);
          enhancedLogger.debug('Created Blob URL for file content:', fileUrl);

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

          enhancedLogger.debug('Blob URL approach successful');
          loadSuccess = true;
        } catch (err) {
          enhancedLogger.warn('Blob URL approach failed:', err.message, err);
          window.kiCanvasBlobUrlsNotSupported = true;
        }
      }

      // Approach 4: Data URL with proper mime type (only for smaller files)
      if (!loadSuccess && fileContent.length < 1000000) {
        try {
          enhancedLogger.debug('Trying data URL approach for smaller file');
          const mimeType = this.getKiCadMimeType(fileExtension);
          const base64Content = this.encodeUtf8ToBase64(fileContent);
          const dataUrl = `data:${mimeType};base64,${base64Content}`;
          sourceElement.setAttribute('src', dataUrl);
          sourceElement.setAttribute('data-format', fileExtension);
          enhancedLogger.debug('Data URL approach successful with mime type:', mimeType);
          loadSuccess = true;
        } catch (err) {
          enhancedLogger.warn('Data URL approach failed:', err.message, err);
        }
      }

      if (!loadSuccess) {
        enhancedLogger.error('All content loading approaches failed');
      } else {
        enhancedLogger.debug('Content loading successful');
      }

      return loadSuccess;
    },
    encodeUtf8ToBase64(str) {
      // Convert string to UTF-8 bytes
      const utf8Bytes = new TextEncoder().encode(str);
      
      // Convert bytes to base64 using built-in methods
      // Create a binary string from the bytes, ensuring each byte stays in Latin1 range
      let binaryString = '';
      for (let i = 0; i < utf8Bytes.length; i++) {
        binaryString += String.fromCharCode(utf8Bytes[i]);
      }
      
      // Now encode to base64
      return btoa(binaryString);
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
