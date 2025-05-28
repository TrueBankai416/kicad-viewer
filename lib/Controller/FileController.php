<?php
declare(strict_types=1);
// SPDX-FileCopyrightText: WARP <development@warp.lv>
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace OCA\kicad_viewer\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\Http\StreamResponse;
use OCP\Files\IRootFolder;
use OCP\IRequest;
use OCP\IUserSession;

class FileController extends Controller {
    
    private IRootFolder $rootFolder;
    private IUserSession $userSession;
    
    public function __construct(
        string $appName,
        IRequest $request,
        IRootFolder $rootFolder,
        IUserSession $userSession
    ) {
        parent::__construct($appName, $request);
        $this->rootFolder = $rootFolder;
        $this->userSession = $userSession;
    }
    
    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     * @PublicPage
     */
    public function getFile(string $path, string $filename): StreamResponse {
        try {
            $user = $this->userSession->getUser();
            if (!$user) {
                return new StreamResponse('', Http::STATUS_UNAUTHORIZED);
            }
            
            $userFolder = $this->rootFolder->getUserFolder($user->getUID());
            $file = $userFolder->get($path);
            
            if (!$file || $file->getType() !== \OCP\Files\FileInfo::TYPE_FILE) {
                return new StreamResponse('', Http::STATUS_NOT_FOUND);
            }
            
            // Get the file content
            $content = $file->getContent();
            $mimeType = $file->getMimeType();
            
            // Create a stream response with proper headers
            $response = new StreamResponse($content);
            $response->addHeader('Content-Type', $mimeType);
            $response->addHeader('Content-Disposition', 'inline; filename="' . $filename . '"');
            $response->addHeader('Content-Length', (string)strlen($content));
            
            return $response;
            
        } catch (\Exception $e) {
            return new StreamResponse('', Http::STATUS_INTERNAL_SERVER_ERROR);
        }
    }
}
