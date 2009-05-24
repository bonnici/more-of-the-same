if (typeof(Cc) == 'undefined')
	var Cc = Components.classes;
if (typeof(Ci) == 'undefined')
	var Ci = Components.interfaces;
if (typeof(Cu) == 'undefined')
	var Cu = Components.utils;
if (typeof(Cr) == 'undefined')
	var Cr = Components.results;
	  
Cu.import("resource://app/jsmodules/sbProperties.jsm");
Cu.import("resource://app/jsmodules/sbLibraryUtils.jsm");
Cu.import("resource://app/jsmodules/kPlaylistCommands.jsm");

const PLAYLIST_PROP = "more-of-the-same_playlist-custom_type";

// Make a namespace.
if (typeof MoreOfTheSame == 'undefined') {
  var MoreOfTheSame = {};
}

/**
 * UI controller that is loaded into the main player window
 */
MoreOfTheSame.Controller = {

  /**
   * Called when the window finishes loading
   */
  onLoad: function() 
  {    
    // initialization code
    this._initialized = true;
    this._strings = document.getElementById("more-of-the-same-strings");
    
    // Perform extra actions the first time the extension is run
    //Cu.reportError(Application.prefs.get("extensions.more-of-the-same.firstrun").value);
    if (Application.prefs.get("extensions.more-of-the-same.firstrun-v105").value) {
      Application.prefs.setValue("extensions.more-of-the-same.firstrun-v105", false);
      this._firstRunSetup();
    }
    
    // Add the toolbar button to the default item set of the browser toolbar.
    // TODO: Should only do this on first run, but Bug 6778 requires doing it
    // every load.
    this._insertToolbarItem("nav-bar", "more-of-the-same-toolbarbutton", "searchbar-container");
    
    // Make a local variable for this controller so that
    // it is easy to access from closures.
    var controller = this;
    
    // My initialisation code
  	this._propMan = Cc["@songbirdnest.com/Songbird/Properties/PropertyManager;1"].getService(Ci.sbIPropertyManager);
  	this._playlist = null;

		// This is used to get the currently playing item
    this._mediacoreManager = Cc["@songbirdnest.com/Songbird/Mediacore/Manager;1"]
                              .getService(Ci.sbIMediacoreManager);

    // This is used to get the currently selected item
    this._windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"]
                            .getService(Ci.nsIWindowMediator);
    
    // Used to make the right click context menu stuff work
    this._commandsManager = Cc["@songbirdnest.com/Songbird/PlaylistCommandsManager;1"]
                       .getService(Ci.sbIPlaylistCommandsManager);
        
    // Add the right click context menus
    // I have no idea why I have to do it this way or why it works but it does work and I'm sick of messing with it
    // Something about bug 7837: http://bugzilla.songbirdnest.com/show_bug.cgi?id=7873
    // Code mainly ripped off from Now Playing mod
    // If you are reading this, please do not copy and paste this code thinking that I knew what I was doing when I wrote it
    this._mainLibraryGUID = gPrefs.getComplexValue("songbird.library.main", Ci.nsISupportsString);
    
    this._mainLibCommandsBuilder = this.getCommandsBuilder();
    
    var mainLibRegisteredCommands = this._commandsManager.getPlaylistCommandsMediaItem(this._mainLibraryGUID, "simple");
    if (!mainLibRegisteredCommands || !mainLibRegisteredCommands.hasMoreElements()) 
    {
      this._mainLibCommandsBuilder.insertPlaylistCommandsBefore(null, "moreOfTheSameSeparatorId", "defaultCommandSet1", 
            this._commandsManager.request(kPlaylistCommands.MEDIAITEM_DEFAULT));
    }
    this._commandsManager.registerPlaylistCommandsMediaItem(this._mainLibraryGUID, "", this._mainLibCommandsBuilder);
    
    this._simplePlaylistsCommandsBuilder = this.getCommandsBuilder();
    
    var simplePlaylistRegisteredCommands = this._commandsManager.getPlaylistCommandsMediaItem("", "simple");

	  // Hack to get around problems when the Now Playing addon is installed 
	  var commandCount = 0;
	  if (simplePlaylistRegisteredCommands) {
	    while (simplePlaylistRegisteredCommands.hasMoreElements()) {
			  var tempItem = simplePlaylistRegisteredCommands.getNext();
	      commandCount++;
	    }
    }
	
    if (commandCount <= 6) 
    {
      this._simplePlaylistsCommandsBuilder.insertPlaylistCommandsBefore(null, "moreOfTheSameSeparatorId", "defaultCommandSet2", 
            this._commandsManager.request(kPlaylistCommands.MEDIAITEM_DEFAULT));
    }
    this._commandsManager.registerPlaylistCommandsMediaItem("", "simple", this._simplePlaylistsCommandsBuilder);
    
    this._smartPlaylistsCommandsBuilder = this.getCommandsBuilder();
    var smartPlaylistRegisteredCommands = this._commandsManager.getPlaylistCommandsMediaItem("", "smart");
    if (!smartPlaylistRegisteredCommands || !smartPlaylistRegisteredCommands.hasMoreElements()) 
    {
      this._smartPlaylistsCommandsBuilder.insertPlaylistCommandsBefore(null, "moreOfTheSameSeparatorId", "defaultCommandSet3", 
            this._commandsManager.request(kPlaylistCommands.MEDIAITEM_SMARTPLAYLIST));
    }
    this._commandsManager.registerPlaylistCommandsMediaItem("", "smart", this._smartPlaylistsCommandsBuilder);
    
    // Attach commands for toolbar button
    this._moreSameCurrentAlbumCmd = document.getElementById("more-of-the-same-current-album-cmd");
    this._moreSameCurrentAlbumCmd.addEventListener("command", 
          function() { controller.createNpAlbumPlaylist(); }, false);
         
    this._moreSameCurrentArtistCmd = document.getElementById("more-of-the-same-current-artist-cmd");
    this._moreSameCurrentArtistCmd.addEventListener("command", 
          function() { controller.createNpArtistPlaylist(); }, false);
          
    this._moreSameCurrentGenreCmd = document.getElementById("more-of-the-same-current-genre-cmd");
    this._moreSameCurrentGenreCmd.addEventListener("command", 
          function() { controller.createNpGenrePlaylist(); }, false);

    this._moreSameCurrentYearCmd = document.getElementById("more-of-the-same-current-year-cmd");
    this._moreSameCurrentYearCmd.addEventListener("command", 
          function() { controller.createNpYearPlaylist(); }, false);

    this._moreSameCurrentAlbumArtistCmd = document.getElementById("more-of-the-same-current-album-artist-cmd");
    this._moreSameCurrentAlbumArtistCmd.addEventListener("command", 
          function() { controller.createNpAlbumArtistPlaylist(); }, false);
          
    this._moreSameSelectedAlbumCmd = document.getElementById("more-of-the-same-sel-album-cmd");
    this._moreSameSelectedAlbumCmd.addEventListener("command", 
          function() { controller.createSelAlbumPlaylist(); }, false);

    this._moreSameSelectedArtistCmd = document.getElementById("more-of-the-same-sel-artist-cmd");
    this._moreSameSelectedArtistCmd.addEventListener("command", 
          function() { controller.createSelArtistPlaylist(); }, false);

    this._moreSameSelectedGenreCmd = document.getElementById("more-of-the-same-sel-genre-cmd");
    this._moreSameSelectedGenreCmd.addEventListener("command", 
          function() { controller.createSelGenrePlaylist(); }, false);

    this._moreSameSelectedYearCmd = document.getElementById("more-of-the-same-sel-year-cmd");
    this._moreSameSelectedYearCmd.addEventListener("command", 
          function() { controller.createSelYearPlaylist(); }, false);

    this._moreSameSelectedAlbumArtistCmd = document.getElementById("more-of-the-same-sel-album-artist-cmd");
    this._moreSameSelectedAlbumArtistCmd.addEventListener("command", 
          function() { controller.createSelAlbumArtistPlaylist(); }, false);
          
    // Listen for the user clicking the toolbar button so the menu items can be updated
    var toolbarButton = document.getElementById("more-of-the-same-toolbarbutton");
    toolbarButton.addEventListener("popupshowing", function(event) { controller.updateToolbarMenu(event); }, false);
    toolbarButton.addEventListener("popuphidden", function(event) { controller.resetToolbarMenu(event); }, false);
    
    // Cache toolbar menu item controls for quick access
    this._toolbarIntroText = document.getElementById("more-of-the-same-tb-intro-text");
    this._toolbarSeparator = document.getElementById("more-of-the-same-tb-separator");
    this._albumToolbarMenuItem = document.getElementById("more-of-the-same-tb-album-menuitem");
    this._artistToolbarMenuItem = document.getElementById("more-of-the-same-tb-artist-menuitem");
    this._genreToolbarMenuItem = document.getElementById("more-of-the-same-tb-genre-menuitem");
    this._yearToolbarMenuItem = document.getElementById("more-of-the-same-tb-year-menuitem");
    this._albumArtistToolbarMenuItem = document.getElementById("more-of-the-same-tb-album-artist-menuitem");
    this._toolbarSeparator2 = document.getElementById("more-of-the-same-tb-separator2");
    this._selAlbumToolbarMenuItem = document.getElementById("more-of-the-same-tb-sel-album-menuitem");
    this._selArtistToolbarMenuItem = document.getElementById("more-of-the-same-tb-sel-artist-menuitem");
    this._selGenreToolbarMenuItem = document.getElementById("more-of-the-same-tb-sel-genre-menuitem");
    this._selYearToolbarMenuItem = document.getElementById("more-of-the-same-tb-sel-year-menuitem");
    this._selAlbumArtistToolbarMenuItem = document.getElementById("more-of-the-same-tb-sel-album-artist-menuitem");
    
    // Properties to use when searching playlists
    this._playlistProps = Cc["@songbirdnest.com/Songbird/Properties/MutablePropertyArray;1"]
     	.createInstance(Ci.sbIMutablePropertyArray);
    this._playlistProps.appendProperty(SBProperties.isList, "1");  
    this._playlistProps.appendProperty(SBProperties.hidden, "0");
  },  
  
  getCommandsBuilder: function()
  {  
    const PlaylistCommandsBuilder = new Components.Constructor("@songbirdnest.com/Songbird/PlaylistCommandsBuilder;1",
                                          "sbIPlaylistCommandsBuilder");

    commandsBuilder = new PlaylistCommandsBuilder();

    var controller = this;
       
    commandsBuilder.appendSeparator(null, "moreOfTheSameSeparatorId");
    commandsBuilder.appendSubmenu(null, "moreOfTheSameSubMenuId", this._strings.getString("subMenuText"), "");
    
    commandsBuilder.appendAction("moreOfTheSameSubMenuId", "createSelAlbumPlaylistId", this._strings.getString("albumMenuText"), 
        this._strings.getString("selectedAlbumMenuTooltip"), function() { controller.createSelAlbumPlaylist(); } );
    commandsBuilder.appendAction("moreOfTheSameSubMenuId", "createSelArtistPlaylistId", this._strings.getString("artistMenuText"),
        this._strings.getString("selectedArtistMenuTooltip"), function() { controller.createSelArtistPlaylist(); } );
    commandsBuilder.appendAction("moreOfTheSameSubMenuId", "createSelGenrePlaylistId", this._strings.getString("genreMenuText"),
        this._strings.getString("selectedGenreMenuTooltip"), function() { controller.createSelGenrePlaylist(); } );
    commandsBuilder.appendAction("moreOfTheSameSubMenuId", "createSelYearPlaylistId", this._strings.getString("yearMenuText"),
        this._strings.getString("selectedYearMenuTooltip"), function() { controller.createSelYearPlaylist(); } );
    commandsBuilder.appendAction("moreOfTheSameSubMenuId", "createSelAlbumArtistPlaylistId", this._strings.getString("albumArtistMenuText"),
        this._strings.getString("selectedAlbumArtistMenuTooltip"), function() { controller.createSelAlbumArtistPlaylist(); } );
        
    return commandsBuilder;
  },
  
  /**
   * Called when the window is about to close
   */
  onUnLoad: function() 
  {
    this._commandsManager.unregisterPlaylistCommandsMediaItem(this._mainLibraryGUID, "", this._mainLibCommandsBuilder);
    this._commandsManager.unregisterPlaylistCommandsMediaItem("", "simple", this._simplePlaylistsCommandsBuilder);
    this._commandsManager.unregisterPlaylistCommandsMediaItem("", "smart", this._smartPlaylistsCommandsBuilder);
    
    this._mainLibCommandsBuilder.shutdown();
    this._simplePlaylistsCommandsBuilder.shutdown();
    this._smartPlaylistsCommandsBuilder.shutdown();
    
    this._initialized = false;
  },
  
  /**
   * Perform extra setup the first time the extension is run
   */
  _firstRunSetup : function() 
  {
    //this._insertToolbarItem("nav-bar", "more-of-the-same-toolbarbutton", "searchbar-container");
  },
  
  _insertToolbarItem: function(toolbar, newItem, insertBefore) {
    var toolbar = document.getElementById(toolbar);
    var list = toolbar.currentSet || "";
    list = list.split(",");
    
    // If this item is not already in the current set, add it
    if (list.indexOf(newItem) == -1)
    {
      // Add to the array, then recombine
      insertBefore = list.indexOf(insertBefore);
      if (insertBefore == -1) {
        list.push(newItem);
      } else {
        list.splice(insertBefore - 1, 0, newItem);
      }
      list = list.join(",");
      
      toolbar.setAttribute("currentset", list);
      toolbar.currentSet = list;
      document.persist(toolbar.id, "currentset");
    }
  },
  
  createNpPlaylist: function(property)
  {
    var item = this.getNowPlayingMediaItem(true);
    if (item != null)
    {
      var currentProperty = item.getProperty(property);
      this.updatePlaylist(property, currentProperty);
    }    
  },
  
  createNpAlbumPlaylist: function() 
  { 
    this.createNpPlaylist(SBProperties.albumName);
  },
  
  createNpArtistPlaylist: function() 
  { 
    this.createNpPlaylist(SBProperties.artistName);
  },
  
  createNpGenrePlaylist: function() 
  { 
    this.createNpPlaylist(SBProperties.genre);
  },
  
  createNpYearPlaylist: function() 
  {
    this.createNpPlaylist(SBProperties.year);
  },

  createNpAlbumArtistPlaylist: function() 
  {
    this.createNpPlaylist(SBProperties.albumArtistName);
  },
  
  createSelectedPlaylist: function(property)
  {
    var items = this.getNowSelectedMediaItems(true);
    
    if (items.length == 0)
    {
      return;
    }
    
    this.clearPlaylist();
    
    for (var i = 0; i < items.length; i++)
    {
      var curItem = items[i];
      var currentProperty = curItem.getProperty(property);
      this.addConditionToPlaylist(property, currentProperty);
    }
    
    this.buildAndShowPlaylist();    
  },

  createSelAlbumPlaylist: function() 
  {
    this.createSelectedPlaylist(SBProperties.albumName);
  },
  
  createSelArtistPlaylist: function() 
  {
    this.createSelectedPlaylist(SBProperties.artistName);
  },

  createSelGenrePlaylist: function() 
  {
    this.createSelectedPlaylist(SBProperties.genre);
  },

  createSelYearPlaylist: function() 
  {
    this.createSelectedPlaylist(SBProperties.year);
  },
  
  createSelAlbumArtistPlaylist: function() 
  {
    this.createSelectedPlaylist(SBProperties.albumArtistName);
  },
  
  createPlaylistIfNeeded: function() 
  {
    this._playlist = null;
    
    // try to find an existing playlist
    try 
    {
  		var itemEnum = LibraryUtils.mainLibrary.getItemsByProperty(SBProperties.customType, PLAYLIST_PROP).enumerate();
  		if (itemEnum.hasMoreElements()) 
  		{
  			this._playlist = itemEnum.getNext();
  		}
  	} 
  	catch (e if e.result == Cr.NS_ERROR_NOT_AVAILABLE) 
  	{
  	  // Don't to anything - playlist will be created
  	}
    
    if (this._playlist == null)
    {
      this._playlist = LibraryUtils.mainLibrary.createMediaList("smart");
  		this._playlist.setProperty(SBProperties.customType, PLAYLIST_PROP); // Set a custom property so we know which playlist is ours
    }  
    
    this._playlist.name = this._strings.getString("playlistName");
    this._playlist.autoUpdate = true;
    this._playlist.matchType = Ci.sbILocalDatabaseSmartMediaList.MATCH_TYPE_ANY;
  },

  updatePlaylist: function(property, name) 
  {
    this.clearPlaylist();
    this.addConditionToPlaylist(property, name);
    this.buildAndShowPlaylist();
  },

  clearPlaylist: function() 
  {
    this.createPlaylistIfNeeded();

    if (this._playlist == null)
    {
      // Should never get here
      alert(this._strings.getString("horribleError"));
      return;
    }

    this._playlist.clearConditions();
  },

  addConditionToPlaylist: function(property, name) 
  {
    if (this._playlist == null)
    {
      // Should never get here
      alert(this._strings.getString("horribleError"));
      return;
    }

    if (property == null)
    {
      // Should never get here
      alert(this._strings.getString("horribleError"));
      return;
    }

    var operator = this._propMan.getPropertyInfo(property).getOperator("=");

    if (operator == null)
    {
      // Should never get here
      alert(this._strings.getString("horribleError"));
      return;      
    }

    this._playlist.appendCondition
  	  (
  	    property,
        operator,
        name,
        null,
        null
      );
  },

  buildAndShowPlaylist: function() 
  {
    if (this._playlist == null)
    {
      // Should never get here
      alert(this._strings.getString("horribleError"));
      return;
    }

    this._playlist.rebuild();
    this.showPlaylist();
  },
  
  getNowPlayingMediaItem: function(showErrors)
  {
    try 
    {
      var nowPlayingItem = this._mediacoreManager.sequencer.currentItem;
      if (nowPlayingItem == null)
      {
        // Should not allow this to get hit, anything leading here should be disabled
        if (showErrors == true)
        {
          alert(this._strings.getString("nothingPlaying"));
        }
        return null;
      }
      
      return nowPlayingItem;
    }
    catch (e) 
  	{
      if (showErrors == true)
      {
        alert(this._strings.getString("nothingPlaying"));
      }
  	  return null;
  	}
  },
  
  getNowSelectedMediaItems: function(showErrors)
  {
    var songbirdWindow = this._windowMediator.getMostRecentWindow("Songbird:Main");     
    var mediaListView = songbirdWindow.gBrowser.currentMediaListView;
    
    if (mediaListView == null)
    {
      // Should never get here?
      if (showErrors)
      {
        alert(this._strings.getString("noListView"));
      }
      return null;
    }
      
    var selection = mediaListView.selection;
    var itemEnum = selection.selectedMediaItems;
    
    // Get the first selected item
    var items = [];
    while (itemEnum.hasMoreElements())
    {
      items.push(itemEnum.getNext());
    }
    
    if (items.length == 0)
    {
        // Should not allow this to get hit, anything leading here should be disabled
        if (showErrors)
        {
          alert(this._strings.getString("nothingSelected"));
        }
        return null;
    }
    
    return items;
  },
  
  showPlaylist: function()
  {
    var gBrowser = this._windowMediator.getMostRecentWindow("Songbird:Main").gBrowser;
                                                         
    if (gBrowser != null)
    {
      // Only switch to the playlist if it is not already displayed
      // Need to use name and length since guid check does not work
      if (gBrowser.currentMediaListView.mediaList.name != this._playlist.name || gBrowser.currentMediaListView.mediaList.length != this._playlist.length)
      {
        gBrowser.loadMediaList(this._playlist);
      }
    }
  },
  
  // Called when the toolbar button is clicked - this is used to update the menu text
  updateToolbarMenu: function(event)
  {
    // Make sure this function only does something if it is the main menu popping up and not the submenu
    if (event.target.id != "more-of-the-same-tb-menu")
    {
      return;
    }
    
    var nowPlayingItem = this.getNowPlayingMediaItem(false);
    var selectedItems = this.getNowSelectedMediaItems(false);
    
    if (nowPlayingItem == null && (selectedItems == null || selectedItems.length == 0))
    {
      this._toolbarIntroText.setAttribute("label", this._strings.getString("nothingPlayingOrSelected"));
      this.hideNowPlayingToolbarMenu();
      this.hideNowSelectedToolbarMenu();
    }
    else
    {
      this._toolbarIntroText.setAttribute("label", this._strings.getString("subMenuText"));
    
      if (nowPlayingItem == null)
      {
        this.hideNowPlayingToolbarMenu();
      }
      else
      {
        this.updateNowPlayingToolbarMenuItems(nowPlayingItem);
      }
    
      if (selectedItems == null || selectedItems.length == 0 || (selectedItems.length == 1 && selectedItems[0] == nowPlayingItem))
      {
        this.hideNowSelectedToolbarMenu();
      }
      else
      {
        this.updateNowSelectedToolbarMenuItems(selectedItems);
      }
    }
  },
  
  hideNowPlayingToolbarMenu: function(show)
  {
    // Can't get setAttribute("disabled", "true") to work so this is my workaround
    this._toolbarSeparator.setAttribute("hidden", "true");
    this._albumToolbarMenuItem.setAttribute("hidden", "true");
    this._artistToolbarMenuItem.setAttribute("hidden", "true");
    this._genreToolbarMenuItem.setAttribute("hidden", "true");
    this._yearToolbarMenuItem.setAttribute("hidden", "true");
    this._albumArtistToolbarMenuItem.setAttribute("hidden", "true");
  },

  hideNowSelectedToolbarMenu: function(show)
  {
    // Can't get setAttribute("disabled", "true") to work so this is my workaround
    this._toolbarSeparator2.setAttribute("hidden", "true");
    this._selAlbumToolbarMenuItem.setAttribute("hidden", "true");
    this._selArtistToolbarMenuItem.setAttribute("hidden", "true");
    this._selGenreToolbarMenuItem.setAttribute("hidden", "true");
    this._selYearToolbarMenuItem.setAttribute("hidden", "true");
    this._selAlbumArtistToolbarMenuItem.setAttribute("hidden", "true");
  },
  
  updateNowPlayingToolbarMenuItems: function(nowPlayingItem)
  {
    this._toolbarSeparator.setAttribute("hidden", "false");
    this._albumToolbarMenuItem.setAttribute("hidden", "false");
    this._artistToolbarMenuItem.setAttribute("hidden", "false");
    this._genreToolbarMenuItem.setAttribute("hidden", "false");
    this._yearToolbarMenuItem.setAttribute("hidden", "false");
    this._albumArtistToolbarMenuItem.setAttribute("hidden", "false");
    
    var nowPlayingAlbum = nowPlayingItem.getProperty(SBProperties.albumName);
    if (!nowPlayingAlbum) nowPlayingAlbum = this._strings.getString("noAlbum");
    this._albumToolbarMenuItem.setAttribute("label", this._strings.getString("albumToolbarMenuText") + " (" + nowPlayingAlbum + ")");
    this._albumToolbarMenuItem.setAttribute("tooltiptext", this._strings.getString("playingAlbumMenuTooltip"));
  
    var nowPlayingArtist = nowPlayingItem.getProperty(SBProperties.artistName);
    if (!nowPlayingArtist) nowPlayingArtist = this._strings.getString("noArtist");
    this._artistToolbarMenuItem.setAttribute("label", this._strings.getString("artistToolbarMenuText") + " (" + nowPlayingArtist + ")");
    this._artistToolbarMenuItem.setAttribute("tooltiptext", this._strings.getString("playingArtistMenuTooltip"));
  
    var nowPlayingGenre = nowPlayingItem.getProperty(SBProperties.genre);
    if (!nowPlayingGenre) nowPlayingGenre = this._strings.getString("noGenre");
    this._genreToolbarMenuItem.setAttribute("label", this._strings.getString("genreToolbarMenuText") + " (" + nowPlayingGenre + ")");
    this._genreToolbarMenuItem.setAttribute("tooltiptext", this._strings.getString("playingGenreMenuTooltip"));
  
    var nowPlayingYear = nowPlayingItem.getProperty(SBProperties.year);
    if (!nowPlayingYear) nowPlayingYear = this._strings.getString("noYear");
    this._yearToolbarMenuItem.setAttribute("label", this._strings.getString("yearToolbarMenuText") + " (" + nowPlayingYear + ")");
    this._yearToolbarMenuItem.setAttribute("tooltiptext", this._strings.getString("playingYearMenuTooltip"));
  
    var nowPlayingAlbumArtist = nowPlayingItem.getProperty(SBProperties.albumArtistName);
    if (!nowPlayingAlbumArtist) nowPlayingAlbumArtist = this._strings.getString("noAlbumArtist");
    this._albumArtistToolbarMenuItem.setAttribute("label", this._strings.getString("albumArtistToolbarMenuText") + " (" + nowPlayingAlbumArtist + ")");
    this._albumArtistToolbarMenuItem.setAttribute("tooltiptext", this._strings.getString("playingAlbumArtistMenuTooltip"));
    
    this.updateNowPlayingContainingPlaylistMenuItems(nowPlayingItem);
  },

  updateNowPlayingContainingPlaylistMenuItems: function(nowPlayingItem)
  {
    var containingPlaylists = this.findContainingPlaylists(nowPlayingItem);
    if (containingPlaylists.length > 0)
    {
      var menu = document.getElementById("more-of-the-same-tb-menu");
      var separator = document.getElementById("more-of-the-same-tb-separator2");

      var submenu = document.createElement("menu");
      submenu.setAttribute("label", this._strings.getString("fromPlaylist"));
      submenu.setAttribute("id", "toolbar-mots-from-playlist");
      submenu.setAttribute("tooltiptext", this._strings.getString("playingPlaylistMenuTooltip"));
      menu.insertBefore(submenu, separator);
      
      this.popupatePlaylistMenuPopup(submenu, containingPlaylists);
    }
  },

  updateNowSelectedToolbarMenuItems: function(nowSelectedItems)
  {
    if (!nowSelectedItems || nowSelectedItems.length == 0)
    {
      // Should not get here if nothing is selected
      return;
    }
    
    this._toolbarSeparator2.setAttribute("hidden", "false");
    this._selAlbumToolbarMenuItem.setAttribute("hidden", "false");
    this._selArtistToolbarMenuItem.setAttribute("hidden", "false");
    this._selGenreToolbarMenuItem.setAttribute("hidden", "false");
    this._selYearToolbarMenuItem.setAttribute("hidden", "false");
    this._selAlbumArtistToolbarMenuItem.setAttribute("hidden", "false");
    
    var nowSelectedAlbum = "";
    var nowSelectedArtist = "";
    var nowSelectedGenre = "";
    var nowSelectedYear = "";
    var nowSelectedAlbumArtist = "";
    
    for (var i = 0; i < nowSelectedItems.length; i++)
    {
      var curItem = nowSelectedItems[i];
      
      curAlbum = curItem.getProperty(SBProperties.albumName);
      if (!curAlbum) curAlbum = this._strings.getString("noAlbum");

      curArtist = curItem.getProperty(SBProperties.artistName);
      if (!curArtist) curArtist = this._strings.getString("noArtist");

      curGenre = curItem.getProperty(SBProperties.genre);
      if (!curGenre) curGenre = this._strings.getString("noGenre");

      curYear = curItem.getProperty(SBProperties.year);
      if (!curYear) curYear = this._strings.getString("noYear");

      curAlbumArtist = curItem.getProperty(SBProperties.albumArtistName);
      if (!curAlbumArtist) curAlbumArtist = this._strings.getString("noAlbumArtist");
      
      if (nowSelectedAlbum != this._strings.getString("multiple"))
      {
        if (nowSelectedAlbum == "")
        {
          nowSelectedAlbum = curAlbum;
        }
        else if (nowSelectedAlbum != curAlbum)
        {
          nowSelectedAlbum = this._strings.getString("multiple");
        }
      }
      
      if (nowSelectedArtist != this._strings.getString("multiple"))
      {
        if (nowSelectedArtist == "")
        {
          nowSelectedArtist = curArtist;
        }
        else if (nowSelectedArtist != curArtist)
        {
          nowSelectedArtist = this._strings.getString("multiple");
        }
      }
      
      if (nowSelectedGenre != this._strings.getString("multiple"))
      {
        if (nowSelectedGenre == "")
        {
          nowSelectedGenre = curGenre;
        }
        else if (nowSelectedGenre != curGenre)
        {
          nowSelectedGenre = this._strings.getString("multiple");
        }
      }
      
      if (nowSelectedYear != this._strings.getString("multiple"))
      {
        if (nowSelectedYear == "")
        {
          nowSelectedYear = curYear;
        }
        else if (nowSelectedYear != curYear)
        {
          nowSelectedYear = this._strings.getString("multiple");
        }
      }

      if (nowSelectedAlbumArtist != this._strings.getString("multiple"))
      {
        if (nowSelectedAlbumArtist == "")
        {
          nowSelectedAlbumArtist = curAlbumArtist;
        }
        else if (nowSelectedAlbumArtist != curAlbumArtist)
        {
          nowSelectedAlbumArtist = this._strings.getString("multiple");
        }
      }
    }
    
    this._selAlbumToolbarMenuItem.setAttribute("label", this._strings.getString("selectedAlbumToolbarMenuText") + " (" + nowSelectedAlbum + ")");
    this._selAlbumToolbarMenuItem.setAttribute("tooltiptext", this._strings.getString("selectedAlbumMenuTooltip"));
    
    this._selArtistToolbarMenuItem.setAttribute("label", this._strings.getString("selectedArtistToolbarMenuText") + " (" + nowSelectedArtist + ")");
    this._selArtistToolbarMenuItem.setAttribute("tooltiptext", this._strings.getString("selectedArtistMenuTooltip"));
    
    this._selGenreToolbarMenuItem.setAttribute("label", this._strings.getString("selectedGenreToolbarMenuText") + " (" + nowSelectedGenre + ")");
    this._selGenreToolbarMenuItem.setAttribute("tooltiptext", this._strings.getString("selectedGenreMenuTooltip"));
    
    this._selYearToolbarMenuItem.setAttribute("label", this._strings.getString("selectedYearToolbarMenuText") + " (" + nowSelectedYear + ")");
    this._selYearToolbarMenuItem.setAttribute("tooltiptext", this._strings.getString("selectedYearMenuTooltip"));
    
    this._selAlbumArtistToolbarMenuItem.setAttribute("label", this._strings.getString("selectedAlbumArtistToolbarMenuText") + " (" + nowSelectedAlbumArtist + ")");
    this._selAlbumArtistToolbarMenuItem.setAttribute("tooltiptext", this._strings.getString("selectedAlbumArtistMenuTooltip"));
    
    if (nowSelectedItems.length == 1)
    {
      this.updateNowSelectedContainingPlaylistMenuItems(nowSelectedItems[0]);
    }
  },
  
  updateNowSelectedContainingPlaylistMenuItems: function(nowSelectedItem)
  {
    var containingPlaylists = this.findContainingPlaylists(nowSelectedItem);
    if (containingPlaylists.length > 0)
    {
      var menu = document.getElementById("more-of-the-same-tb-menu");
  
      var submenu = document.createElement("menu");
      submenu.setAttribute("label", this._strings.getString("selectedFromPlaylist"));
      submenu.setAttribute("id", "toolbar-mots-selected-from-playlist");
      
      submenu.setAttribute("tooltiptext", this._strings.getString("selectedPlaylistMenuTooltip"));
      menu.appendChild(submenu);
      
      this.popupatePlaylistMenuPopup(submenu, containingPlaylists);
    }
  },
  
  popupatePlaylistMenuPopup: function(submenu, containingPlaylists)
  {
    var submenupopup = document.createElement("menupopup");
    submenu.appendChild(submenupopup);

    for (var i = 0; i < containingPlaylists.length; i++)
    {        
      var menuitem = document.createElement("menuitem");
      menuitem.setAttribute("label", containingPlaylists[i][0].name);
      menuitem.setAttribute("oncommand", "MoreOfTheSame.Controller.showPlaylistByGuid(\""
            + containingPlaylists[i][0].guid + "\", " + containingPlaylists[i][1] + ");");
      menuitem.setAttribute("tooltiptext", "");
      submenupopup.appendChild(menuitem);
    }
  },
  
  showPlaylistByGuid: function(guid, index)
  {
    var playlist = LibraryUtils.mainLibrary.getItemByGuid(guid);
    
    var gBrowser = this._windowMediator.getMostRecentWindow("Songbird:Main").gBrowser;

    if (gBrowser != null)
    {
      // Only switch to the playlist if it is not already displayed
      // Need to use name and length since guid check does not work
      if (gBrowser.currentMediaListView.mediaList.name != playlist.name || gBrowser.currentMediaListView.mediaList.length != playlist.length)
      {
        gBrowser.loadMediaList(playlist);
      }
    }
  },
  
  resetToolbarMenu: function(event)
  {
    // Make sure this function only does something if it is the main menu popping up and not the submenu
    if (event.target.id != "more-of-the-same-tb-menu")
    {
      return;
    }
    
    var menu = document.getElementById("more-of-the-same-tb-menu");
    
    var submenuPlaying = document.getElementById("toolbar-mots-from-playlist");
    if (submenuPlaying && menu)
    {
      menu.removeChild(submenuPlaying);
    }
    
    var submenuSelected = document.getElementById("toolbar-mots-selected-from-playlist");
    if (submenuSelected && menu)
    {
      menu.removeChild(submenuSelected);
    }
  },
  
  findContainingPlaylists: function(mediaItem)
  {
    var playlists = [];    
    
    try 
    {
  		var itemEnum = LibraryUtils.mainLibrary.getItemsByProperties(this._playlistProps).enumerate();
  		while (itemEnum.hasMoreElements()) 
  		{
  			var playlist = itemEnum.getNext();
  			
  			if (playlist.contains(mediaItem) && playlist.name != null)
  			{
  			  var indexOfItem = playlist.indexOf(mediaItem);
    			playlists.push(new Array(2));
    			playlists[playlists.length - 1][0] = playlist;
    			playlists[playlists.length - 1][1] = indexOfItem;
			  }
  		}
  	} 
  	catch (e if e.result == Cr.NS_ERROR_NOT_AVAILABLE) 
  	{
  	}
  	
    
    return playlists;
  }

  
};

window.addEventListener("load", function(e) { MoreOfTheSame.Controller.onLoad(e); }, false);
window.addEventListener("unload", function(e) { MoreOfTheSame.Controller.onUnLoad(e); }, false);
