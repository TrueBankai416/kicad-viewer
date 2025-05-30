<?php
declare(strict_types=1);
// SPDX-FileCopyrightText: WARP <development@warp.lv>
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace OCA\kicad_viewer\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\StreamResponse;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;

class FileController extends Controller {
    
    private static $publicTokens = [];
    
    public function __construct(string $appName, IRequest $request) {
        parent::__construct($appName, $request);
    }
    
    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     * @PublicPage
     */
    public function test(): StreamResponse {
        return new StreamResponse('Hello from KiCAD Viewer!', Http::STATUS_OK);
    }
    
    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     * @PublicPage
     */
    public function getFile(string $path, string $filename): StreamResponse {
        try {
            // Use global Nextcloud services
            $userSession = \OC::$server->getUserSession();
            $rootFolder = \OC::$server->getRootFolder();
            
            $user = $userSession->getUser();
            if (!$user) {
                return $this->createErrorResponse('User not found', Http::STATUS_UNAUTHORIZED, $filename);
            }
            
            $userFolder = $rootFolder->getUserFolder($user->getUID());
            
            // Use filename as the file path since we're passing the same value for both
            try {
                $file = $userFolder->get($filename);
            } catch (\Exception $e) {
                // File not found - return appropriate KiCAD content instead of HTML error
                return $this->createMissingFileResponse($filename);
            }
            
            if (!$file || $file->getType() !== \OCP\Files\FileInfo::TYPE_FILE) {
                return $this->createMissingFileResponse($filename);
            }
            
            // Get the file content and MIME type
            $content = $file->getContent();
            $mimeType = $file->getMimeType();
            
            // Create response with proper headers for KiCanvas
            $response = new StreamResponse($content);
            $response->addHeader('Content-Type', $mimeType);
            $response->addHeader('Content-Disposition', 'inline; filename="' . $filename . '"');
            $response->addHeader('Content-Length', (string)strlen($content));
            $response->addHeader('Access-Control-Allow-Origin', '*');
            $response->addHeader('Access-Control-Allow-Methods', 'GET');
            $response->addHeader('Access-Control-Allow-Headers', 'Content-Type');
            
            return $response;
            
        } catch (\Exception $e) {
            return $this->createErrorResponse('Server error: ' . $e->getMessage(), Http::STATUS_INTERNAL_SERVER_ERROR, $filename);
        }
    }
    
    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     */
    public function createPublicToken() {
        try {
            $userSession = \OC::$server->getUserSession();
            $user = $userSession->getUser();
            if (!$user) {
                return ['error' => 'User not found'];
            }
            
            $filePath = $this->request->getParam('filePath');
            if (!$filePath) {
                return ['error' => 'File path is required'];
            }
            
            // Create a unique token
            $token = bin2hex(random_bytes(32));
            
            // Store token with file path and user context (expires in 1 hour)
            self::$publicTokens[$token] = [
                'filePath' => $filePath,
                'userId' => $user->getUID(),
                'expires' => time() + 3600
            ];
            
            return ['token' => $token];
            
        } catch (\Exception $e) {
            return ['error' => 'Server error: ' . $e->getMessage()];
        }
    }
    
    /**
     * Create a response for missing KiCAD files with appropriate content type
     */
    private function createMissingFileResponse(string $filename): StreamResponse {
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        $mimeType = $this->getKiCadMimeType($extension);
        
        // Return minimal valid KiCAD content instead of HTML error
        $content = $this->getMinimalKiCadContent($extension);
        
        $response = new StreamResponse($content);
        $response->addHeader('Content-Type', $mimeType);
        $response->addHeader('Content-Disposition', 'inline; filename="' . $filename . '"');
        $response->addHeader('Content-Length', (string)strlen($content));
        $response->addHeader('Access-Control-Allow-Origin', '*');
        $response->addHeader('Access-Control-Allow-Methods', 'GET');
        $response->addHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        return $response;
    }
    
    /**
     * Create error response with appropriate content type for KiCAD files
     */
    private function createErrorResponse(string $message, int $statusCode, string $filename = ''): StreamResponse {
        // For KiCAD files, return minimal content instead of HTML errors
        if ($filename && $this->isKiCadFile($filename)) {
            return $this->createMissingFileResponse($filename);
        }
        
        return new StreamResponse($message, $statusCode);
    }
    
    /**
     * Check if filename is a KiCAD file
     */
    private function isKiCadFile(string $filename): bool {
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        $kicadExtensions = ['kicad_sch', 'kicad_pcb', 'kicad_pro', 'kicad_wks', 'kicad_mod', 'kicad_sym'];
        return in_array($extension, $kicadExtensions);
    }
    
    /**
     * Get MIME type for KiCAD file extensions
     */
    private function getKiCadMimeType(string $extension): string {
        $mimeMap = [
            'kicad_pcb' => 'application/x-kicad-pcb',
            'kicad_sch' => 'application/x-kicad-schematic',
            'kicad_pro' => 'application/x-kicad-project',
            'kicad_wks' => 'application/x-kicad-workspace',
            'kicad_mod' => 'application/x-kicad-footprint',
            'kicad_sym' => 'application/x-kicad-symbol'
        ];
        
        return $mimeMap[$extension] ?? 'text/plain';
    }
    
    /**
     * Get minimal valid KiCAD content for missing files
     */
    private function getMinimalKiCadContent(string $extension): string {
        switch ($extension) {
            case 'kicad_sch':
                return '(kicad_sch (version 20230121) (generator eeschema)
  (uuid ' . bin2hex(random_bytes(16)) . ')
  (paper "A4")
  (title_block
    (title "Missing File")
    (date "")
    (rev "")
    (company "")
  )
)';
            case 'kicad_pcb':
                return '(kicad_pcb (version 20230121) (generator pcbnew)
  (general
    (thickness 1.6)
  )
  (paper "A4")
  (title_block
    (title "Missing File")
  )
  (layers
    (0 "F.Cu" signal)
    (31 "B.Cu" signal)
  )
)';
            case 'kicad_pro':
                return '{
  "board": {
    "design_settings": {},
    "layer_presets": [],
    "viewports": []
  },
  "boards": [],
  "libraries": {},
  "meta": {
    "filename": "missing.kicad_pro",
    "version": 1
  },
  "net_settings": {},
  "pcbnew": {},
  "schematic": {},
  "sheets": []
}';
            default:
                return '# Missing KiCAD file';
        }
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     * @PublicPage
     */
    public function getPublicFile(string $filename): StreamResponse {
        try {
            // Use global Nextcloud services
            $userSession = \OC::$server->getUserSession();
            $rootFolder = \OC::$server->getRootFolder();
            
            $user = $userSession->getUser();
            if (!$user) {
                return $this->createErrorResponse('User not found', Http::STATUS_UNAUTHORIZED, $filename);
            }
            
            $userFolder = $rootFolder->getUserFolder($user->getUID());
            
            // Try to get the file
            try {
                $file = $userFolder->get($filename);
            } catch (\Exception $e) {
                // File not found - return appropriate KiCAD content instead of HTML error
                return $this->createMissingFileResponse($filename);
            }
            
            if (!$file || $file->getType() !== \OCP\Files\FileInfo::TYPE_FILE) {
                return $this->createMissingFileResponse($filename);
            }
            
            // Get the file content and MIME type
            $content = $file->getContent();
            $mimeType = $file->getMimeType();
            
            // Create response with proper headers for KiCanvas
            $response = new StreamResponse($content);
            $response->addHeader('Content-Type', $mimeType);
            $response->addHeader('Content-Disposition', 'inline; filename="' . $filename . '"');
            $response->addHeader('Content-Length', (string)strlen($content));
            $response->addHeader('Access-Control-Allow-Origin', '*');
            $response->addHeader('Access-Control-Allow-Methods', 'GET');
            $response->addHeader('Access-Control-Allow-Headers', 'Content-Type');
            
            return $response;
            
        } catch (\Exception $e) {
            return $this->createErrorResponse('Server error: ' . $e->getMessage(), Http::STATUS_INTERNAL_SERVER_ERROR, $filename);
        }
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     * @PublicPage
     */
    public function getPublicFileByToken(string $token): StreamResponse {
        try {
            // Check if token exists and is valid
            if (!isset(self::$publicTokens[$token])) {
                return new StreamResponse('Token not found', Http::STATUS_NOT_FOUND);
            }
            
            $tokenData = self::$publicTokens[$token];
            
            // Check if token has expired
            if (time() > $tokenData['expires']) {
                unset(self::$publicTokens[$token]);
                return new StreamResponse('Token expired', Http::STATUS_GONE);
            }
            
            // Get file using stored user context
            $rootFolder = \OC::$server->getRootFolder();
            $userFolder = $rootFolder->getUserFolder($tokenData['userId']);
            $file = $userFolder->get($tokenData['filePath']);
            
            if (!$file || $file->getType() !== \OCP\Files\FileInfo::TYPE_FILE) {
                return new StreamResponse('File not found', Http::STATUS_NOT_FOUND);
            }
            
            // Get the file content and MIME type
            $content = $file->getContent();
            $mimeType = $file->getMimeType();
            
            // Create response with proper headers and CORS for KiCanvas
            $response = new StreamResponse($content);
            $response->addHeader('Content-Type', $mimeType);
            $response->addHeader('Content-Disposition', 'inline; filename="' . $file->getName() . '"');
            $response->addHeader('Content-Length', (string)strlen($content));
            $response->addHeader('Access-Control-Allow-Origin', '*');
            $response->addHeader('Access-Control-Allow-Methods', 'GET');
            $response->addHeader('Access-Control-Allow-Headers', 'Content-Type');
            
            return $response;
            
        } catch (\Exception $e) {
            return new StreamResponse('Server error: ' . $e->getMessage(), Http::STATUS_INTERNAL_SERVER_ERROR);
        }
    }
}
