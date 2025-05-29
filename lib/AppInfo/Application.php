<?php
declare(strict_types=1);
// SPDX-FileCopyrightText: WARP <development@warp.lv>
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace OCA\kicad_viewer\AppInfo;

use OCA\kicad_viewer\Listener\LoadViewerListener;
use OCP\AppFramework\App;
use OCA\Viewer\Event\LoadViewer;

class Application extends App {
	public const APP_ID = 'kicad_viewer';

	public function __construct() {
		parent::__construct(self::APP_ID);
		error_log('DEBUG: kicad_viewer Application constructed (simple App)');
		
		// Register viewer listener using correct Nextcloud 32 method
		try {
			$eventDispatcher = \OC::$server->get(\OCP\EventDispatcher\IEventDispatcher::class);
			$eventDispatcher->addServiceListener(LoadViewer::class, LoadViewerListener::class);
			error_log('DEBUG: kicad_viewer LoadViewer listener registered directly');
		} catch (\Exception $e) {
			error_log('DEBUG: kicad_viewer failed to register listener: ' . $e->getMessage());
		}
	}
}
