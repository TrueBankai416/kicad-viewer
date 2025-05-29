<!--
SPDX-FileCopyrightText: WARP <development@warp.lv>
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <div :class="$style.containApp" :id="`${uuid}`">
    <section :class="$style.containCanvas">
      <div v-if="isLoading" :class="$style.loadingContainer">
        <div :style="{ backgroundImage: `url('${appIconUrl}')` }"></div>
      </div>
      <kicanvas-embed 
        v-else 
        controls="basic" 
        :class="$style.kicanvasEmbed">
        <kicanvas-source 
          ref="kicanvasSource"
          :name="kicanvasFilename"
          :type="kicanvasType">
        </kicanvas-source>
      </kicanvas-embed>
    </section>
  </div>
</template>

<script
  src="./App.mjs"
></script>

<style
  module
  lang="scss"
  src="./App.module.scss"
></style>
