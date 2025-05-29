<?php
declare(strict_types=1);
// SPDX-FileCopyrightText: WARP <development@warp.lv>
// SPDX-License-Identifier: AGPL-3.0-or-later

return [
    'routes' => [
        [
            'name' => 'file#test',
            'url' => '/test',
            'verb' => 'GET'
        ],
        [
            'name' => 'file#getFile',
            'url' => '/api/file/{path}/{filename}',
            'verb' => 'GET',
            'requirements' => [
                'path' => '.+',
                'filename' => '.+'
            ]
        ]
    ]
];
