<?php
declare(strict_types=1);
// SPDX-FileCopyrightText: WARP <development@warp.lv>
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace OCA\kicad_viewer\AppInfo;
use OCA\kicad_viewer\Listener\AddCspEventListener;
use OCA\kicad_viewer\Listener\LoadViewerListener;
use OCA\kicad_viewer\Listener\LoadPublicViewerListener;

use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IRegistrationContext;

use OCP\AppFramework\Http\Events\BeforeTemplateRenderedEvent;
use OCP\AppFramework\Http\ContentSecurityPolicy;
use OCP\Security\CSP\AddContentSecurityPolicyEvent;
use OCA\Viewer\Event\LoadViewer;

class Application extends App implements IBootstrap {

	public static function APP_ID() {
		$xml = simplexml_load_string(file_get_contents(realpath(__DIR__ . '/../../appinfo/info.xml')));
		return ($xml === false) ? null : (string)$xml->id;
	}

	public function __construct() {
		parent::__construct(self::APP_ID());
	}

	public function register(IRegistrationContext $context): void {
		$context->registerEventListener(LoadViewer::class, LoadViewerListener::class);
		$context->registerEventListener(BeforeTemplateRenderedEvent::class, LoadPublicViewerListener::class);
		$context->registerEventListener(AddContentSecurityPolicyEvent::class, AddCspEventListener::class);
		
		// Register FileController with dependency injection
		$context->registerService(\OCA\kicad_viewer\Controller\FileController::class, function($c) {
			return new \OCA\kicad_viewer\Controller\FileController(
				$c->query('AppName'),
				$c->query(\OCP\IRequest::class),
				$c->query(\OCP\Files\IRootFolder::class),
				$c->query(\OCP\IUserSession::class)
			);
		});
	}

	public function boot(IBootContext $context): void {
		// drastic
		// $server_name = isset($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : '';
		// $cspManager = \OC::$server->getContentSecurityPolicyManager(); // DEPR:
		// $csp = new ContentSecurityPolicy();
		// $csp->addAllowedScriptDomain("'self' ".$server_name);
		// $csp->addAllowedImageDomain('*');
		// $csp->addAllowedFontDomain("'self'");
		// $cspManager->addDefaultPolicy($csp); // DEPR:
	}
}
