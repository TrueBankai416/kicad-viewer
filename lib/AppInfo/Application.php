<?php
declare(strict_types=1);
// SPDX-FileCopyrightText: WARP <development@warp.lv>
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace OCA\kicad_viewer\AppInfo;

use OCP\AppFramework\App;

class Application extends App {

	public static function APP_ID() {
		$xml = simplexml_load_string(file_get_contents(realpath(__DIR__ . '/../../appinfo/info.xml')));
		return ($xml === false) ? null : (string)$xml->id;
	}

	public function __construct() {
		parent::__construct(self::APP_ID());
		error_log('DEBUG: kicad_viewer Application constructed');
	}
}
