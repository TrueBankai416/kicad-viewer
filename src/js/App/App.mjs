/**
 * SPDX-FileCopyrightText: WARP <development@warp.lv>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import {v4 as uuidv4} from 'uuid';
import {generateFilePath, generateUrl} from '@nextcloud/router';
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
      // Remove all KiCanvas reactive properties to avoid DOMPurify conflicts
      kicanvasFilename: null,
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

        enhancedLogger.debug('File content loaded, length:', fileContent.length);

        // Initialize KiCanvas while still loading - set content before showing
        this.initKiCanvas(fileContent, fileExtension);
      }
      catch (error) {
        enhancedLogger.error('Error loading KiCad file:', error);
        this.isLoading = false;
      }
    },
    initKiCanvas(fileContent, fileExtension) {
      enhancedLogger.info('=== Starting KiCanvas initialization (pure DOM approach) ===');
      
      try {
        const mimeType = this.getKiCadMimeType(fileExtension);
        
        // Use pure DOM manipulation to avoid ALL Vue reactivity and DOMPurify conflicts
        enhancedLogger.debug('Using pure DOM approach - no Vue reactive properties');
        
        // Only set filename for Vue binding, everything else is direct DOM
        this.kicanvasFilename = this.basename;
        
        enhancedLogger.debug('File info for KiCanvas:', {
          contentLength: fileContent.length,
          type: mimeType,
          filename: this.basename,
          format: fileExtension,
          method: 'Pure DOM manipulation'
        });

        enhancedLogger.info('=== KiCanvas initialization completed successfully (pure DOM) ===');
        
        // Set all attributes and content directly via DOM to avoid DOMPurify
        this.$nextTick(() => {
          setTimeout(() => {
            const sourceElement = this.$refs.kicanvasSource;
            if (sourceElement) {
              // Set all attributes directly on DOM element
              sourceElement.setAttribute('type', mimeType);
              sourceElement.setAttribute('name', this.basename);
              sourceElement.textContent = fileContent;
              
              enhancedLogger.debug('Manually set KiCanvas source via pure DOM:', {
                element: sourceElement.tagName,
                name: sourceElement.getAttribute('name'),
                type: sourceElement.getAttribute('type'),
                contentLength: sourceElement.textContent.length,
                contentPreview: sourceElement.textContent.substring(0, 100) + '...'
              });
              
              // Trigger multiple KiCanvas refresh methods
              const embed = sourceElement.parentElement;
              
              // Set content first, then show element
              enhancedLogger.debug('Content set while element hidden');
              
              // Now make element visible - KiCanvas should find content immediately  
              this.isLoading = false;
              enhancedLogger.debug('Made KiCanvas visible with content ready');
              
              // Give KiCanvas a moment to scan for sources, then try gentle refresh
              setTimeout(() => {
                const embed = sourceElement.parentElement;
                if (embed && typeof embed.update === 'function') {
                  embed.update();
                  enhancedLogger.debug('Called gentle KiCanvas refresh after visibility');
                }
              }, 200);
              
              enhancedLogger.debug('KiCanvas setup completed successfully');
            } else {
              enhancedLogger.error('KiCanvas source ref not found');
            }
          }, 100);
        });
        
      } catch (error) {
        enhancedLogger.error('=== KiCanvas initialization failed ===', error);
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
