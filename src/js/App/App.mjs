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

        // Initialize KiCanvas with improved error handling
        await this.initKiCanvas(fileContent, fileExtension);
      }
      catch (error) {
        enhancedLogger.error('Error loading KiCad file:', error);
        this.showErrorAndStopLoading('Failed to load KiCad file: ' + error.message);
      }
    },
    async initKiCanvas(fileContent, fileExtension) {
      enhancedLogger.info('=== Starting KiCanvas initialization ===');
      
      try {
        const mimeType = this.getKiCadMimeType(fileExtension);
        
        // Set filename for Vue binding
        this.kicanvasFilename = this.basename;
        
        enhancedLogger.debug('File info for KiCanvas:', {
          contentLength: fileContent.length,
          type: mimeType,
          filename: this.basename,
          format: fileExtension
        });

        // Wait for Vue to update the DOM
        await this.$nextTick();
        
        // Wait a bit more to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const sourceElement = this.$refs.kicanvasSource;
        if (!sourceElement) {
          throw new Error('KiCanvas source element not found in DOM');
        }

        // Try multiple approaches to load content
        let loadSuccess = await this.loadContentIntoKiCanvas(sourceElement, fileContent, fileExtension, mimeType);
        
        if (!loadSuccess) {
          throw new Error('Failed to load content into KiCanvas using any method');
        }

        enhancedLogger.debug('Content loaded successfully, stopping loading spinner');
        this.isLoading = false;
        
        // Give KiCanvas a moment to render, then try to trigger update
        setTimeout(() => {
          try {
            const embed = sourceElement.parentElement;
            if (embed && typeof embed.update === 'function') {
              embed.update();
              enhancedLogger.debug('Called KiCanvas update after content load');
            }
          } catch (e) {
            enhancedLogger.debug('KiCanvas update failed, but content is loaded:', e.message);
          }
        }, 300);
        
        enhancedLogger.info('=== KiCanvas initialization completed successfully ===');
        
      } catch (error) {
        enhancedLogger.error('=== KiCanvas initialization failed ===', error);
        this.showErrorAndStopLoading('Failed to initialize KiCanvas: ' + error.message);
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
    async loadContentIntoKiCanvas(sourceElement, fileContent, fileExtension, mimeType) {
      enhancedLogger.debug('Starting loadContentIntoKiCanvas with file extension:', fileExtension);
      enhancedLogger.debug('File content length:', fileContent.length);

      // Try approaches in order of preference and reliability
      const approaches = [
        () => this.tryBlobUrl(sourceElement, fileContent, fileExtension, mimeType),
        () => this.tryTextContent(sourceElement, fileContent, fileExtension),
        () => this.tryDataUrl(sourceElement, fileContent, fileExtension, mimeType),
        () => this.tryDirectContent(sourceElement, fileContent)
      ];

      for (let i = 0; i < approaches.length; i++) {
        try {
          enhancedLogger.debug(`Trying loading approach ${i + 1}/${approaches.length}`);
          const success = await approaches[i]();
          if (success) {
            enhancedLogger.debug(`Loading approach ${i + 1} successful`);
            return true;
          }
        } catch (err) {
          enhancedLogger.debug(`Loading approach ${i + 1} failed:`, err.message);
        }
      }

      enhancedLogger.error('All content loading approaches failed');
      return false;
    },

    tryBlobUrl(sourceElement, fileContent, fileExtension, mimeType) {
      enhancedLogger.debug('Trying blob URL approach');
      
      const blob = new Blob([fileContent], { type: mimeType });
      const fileUrl = URL.createObjectURL(blob);
      
      sourceElement.setAttribute('src', fileUrl);
      sourceElement.setAttribute('type', mimeType);
      sourceElement.setAttribute('name', this.basename);
      sourceElement.setAttribute('data-format', fileExtension);
      
      // Clean up the URL after a reasonable time
      setTimeout(() => {
        try {
          URL.revokeObjectURL(fileUrl);
          enhancedLogger.debug('Blob URL cleaned up');
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 60000);
      
      return true;
    },

    tryTextContent(sourceElement, fileContent, fileExtension) {
      enhancedLogger.debug('Trying text content approach');
      
      sourceElement.textContent = fileContent;
      sourceElement.setAttribute('data-format', fileExtension);
      sourceElement.setAttribute('name', this.basename);
      
      return true;
    },

    tryDataUrl(sourceElement, fileContent, fileExtension, mimeType) {
      if (fileContent.length > 1000000) {
        throw new Error('File too large for data URL approach');
      }
      
      enhancedLogger.debug('Trying data URL approach');
      
      const base64Content = this.encodeUtf8ToBase64(fileContent);
      const dataUrl = `data:${mimeType};base64,${base64Content}`;
      
      sourceElement.setAttribute('src', dataUrl);
      sourceElement.setAttribute('type', mimeType);
      sourceElement.setAttribute('name', this.basename);
      sourceElement.setAttribute('data-format', fileExtension);
      
      return true;
    },

    tryDirectContent(sourceElement, fileContent) {
      enhancedLogger.debug('Trying direct content setting');
      
      if (typeof sourceElement.setContent !== 'function') {
        throw new Error('setContent method not available');
      }
      
      sourceElement.setContent(fileContent);
      return true;
    },

    showErrorAndStopLoading(message) {
      enhancedLogger.error('Showing error and stopping loading:', message);
      this.isLoading = false;
      
      // Show error message to user - could enhance this with a proper error UI
      console.error('[KiCAD Viewer Error]', message);
      
      // Optionally show an alert for now (could be replaced with better UI)
      if (isDebugMode()) {
        alert('KiCAD Viewer Error: ' + message);
      }
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
