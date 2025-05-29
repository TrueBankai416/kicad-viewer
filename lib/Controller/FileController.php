<?php
declare(strict_types=1);
// SPDX-FileCopyrightText: WARP <development@warp.lv>
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace OCA\kicad_viewer\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\StreamResponse;
use OCP\IRequest;

class FileController extends Controller {
    
    public function __construct(string $appName, IRequest $request) {
        parent::__construct($appName, $request);
    }
    
    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     */
    public function getFile(string $path, string $filename): StreamResponse {
        try {
            // Use global Nextcloud services
            $userSession = \OC::$server->getUserSession();
            $rootFolder = \OC::$server->getRootFolder();
            
            $user = $userSession->getUser();
            if (!$user) {
                return new StreamResponse('User not found', Http::STATUS_UNAUTHORIZED);
            }
            
            $userFolder = $rootFolder->getUserFolder($user->getUID());
            
            // Use filename as the file path since we're passing the same value for both
            $file = $userFolder->get($filename);
            
            if (!$file || $file->getType() !== \OCP\Files\FileInfo::TYPE_FILE) {
                return new StreamResponse('File not found', Http::STATUS_NOT_FOUND);
            }
            
            // Get the file content and MIME type
            $content = $file->getContent();
            $mimeType = $file->getMimeType();
            
            // Create response with proper headers for KiCanvas
            $response = new StreamResponse($content);
            $response->addHeader('Content-Type', $mimeType);
            $response->addHeader('Content-Disposition', 'inline; filename="' . $filename . '"');
            $response->addHeader('Content-Length', (string)strlen($content));
            
            return $response;
            
        } catch (\Exception $e) {
            return new StreamResponse('Server error: ' . $e->getMessage(), Http::STATUS_INTERNAL_SERVER_ERROR);
        }
    }
}
