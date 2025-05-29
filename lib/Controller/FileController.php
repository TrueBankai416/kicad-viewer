<?php
declare(strict_types=1);
// SPDX-FileCopyrightText: WARP <development@warp.lv>
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace OCA\kicad_viewer\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\DataResponse;
use OCP\IRequest;

class FileController extends Controller {
    
    public function __construct(string $appName, IRequest $request) {
        parent::__construct($appName, $request);
    }
    
    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     * @PublicPage
     */
    public function getFile(string $path, string $filename): DataResponse {
        // Simple test response first
        return new DataResponse([
            'message' => 'FileController is working!',
            'path' => $path,
            'filename' => $filename
        ]);
    }
}
