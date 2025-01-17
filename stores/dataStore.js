/* eslint-disable no-unused-vars */

/*
 * @file:    \stores\DataStore.js
 * @desc:    ...
 * -------------------------------------------
 * Created Date: 14th November 2023
 * Modified: Wed Jan 10 2024
 */

let $nuxt = null

//+-------------------------------------------------
// Data repositories
// Those objects hold collections of games from multiple sources
// Data is the complete list of games available to search
// Data is updated every time a repository is loaded or a game is added
// ---
// Library is loaded on init and updated when a game is added
// ---
// All elements are indexed by uuid
//+-------------------------------------------------

let data = {}

// let states = {}
let library = {}
let wishlist = {}

//+-------------------------------------------------
// repos
// Repositories are searches and preset filters
// They are stored in the database and can be updated
//+-------------------------------------------------

let repos = {}
let search = {}

//+-------------------------------------------------
// index (ed, api, epic, igdb, steam)
// Have indexed values for each of the stores
//+-------------------------------------------------

let index = {
  ed: [],

  api: {},
  epic: {},
  igdb: {},
  steam: {},
}

export const useDataStore = defineStore('data', {
  state: () => ({
    app: {},

    api: {},
    queue: [],
    loaded: [],
    indexes: [],

    isReady: false,

    meta: {
      time: 0,
      timeout: 5 * 60 * 1000,
      loading: false,
    },
  }),

  //+-------------------------------------------------
  // 🛞 Actions
  //+-------------------------------------------------

  actions: {
    status() {
      console.warn('Data satus')
      console.log('Data', data)

      console.table({
        'Loaded': this.loaded.join(', '),
        'Indexes': this.indexes.join(', '),
        '-- Data --': '----',
        'Api': JSON.stringify(this.api),
        'Data': Object.keys(data).length,
        // 'States': Object.keys(states).length,
        'Library': Object.keys(library).length,
        'Wishlist': Object.keys(wishlist).length,
        '-- Repos --': '----',
        'Repos': Object.keys(repos).join(', '),
        'Search': Object.keys(search).join(', '),
        '-- Index --': '----',
        'Indexed': index.ed.length,
        'API': Object.keys(index.api).length,
        'Epic': Object.keys(index.epic).length,
        'Steam': Object.keys(index.steam).length,
        '-- Queue --': '----',
        'Queue': this.queue.length,
      })

      console.warn(data[index['steam'][440]])
    },

    //+-------------------------------------------------
    // list()
    // Returns the whole data object
    // -----
    // Created on Tue Nov 21 2023
    //+-------------------------------------------------
    list() {
      return data
    },

    //+-------------------------------------------------
    // library()
    // Returns the library object
    // -----
    // Created on Mon Dec 25 2023
    //+-------------------------------------------------
    library(as = 'object') {
      if (as == 'array') return Object.values(library)

      return library
    },

    //+-------------------------------------------------
    // get()
    // Get an element by uuid
    // -----
    // Created on Tue Nov 14 2023
    //+-------------------------------------------------
    get(uuid) {
      return data[uuid]
    },

    //+-------------------------------------------------
    // load()
    // Sets an element by uuid to this.app to be used
    // -----
    // Created on Thu Jan 04 2024
    //+-------------------------------------------------
    load(uuid) {
      this.app = data[uuid]
    },

    //+-------------------------------------------------
    // count()
    // Returns the amount of elements in the source store
    // -----
    // Created on Wed Jan 10 2024
    //+-------------------------------------------------
    count(source) {
      if (['data', 'library'].includes(source)) return Object.keys(data).length

      return 0
    },

    //+-------------------------------------------------
    // search(hash)
    // Performs a search against the api
    // -----
    // Created on Fri Nov 24 2023
    //+-------------------------------------------------
    async search(hash) {
      if (search[hash]) {
        console.warn('Search', hash, 'already done')
        return
      }

      search[hash] = true
      const jxr = await $nuxt.$axios.get(`repository/${hash}.json`)
      if (jxr.status) {
        console.warn('Search', hash, jxr.data)
        this.toData(jxr.data, 'api')
      }
    },

    //+-------------------------------------------------
    // getTop()
    // NOTE: Belongs to a repository store
    // -----
    // Created on Wed Dec 20 2023
    //+-------------------------------------------------
    async getTop(batch) {
      if (!batch) return
      if (this.loaded.includes(`top:${batch}`)) return

      const jxr = await $nuxt.$axios.get(`repository/top-${batch}.json`)
      if (jxr.status) {
        this.toData(jxr.data, 'api')
        this.loaded.push(`top:${batch}`)
      }
    },

    //+-------------------------------------------------
    // update()
    // Updates an app in memory and adds it to the queue
    // Tries to find the app in the api index
    // TODO: split this in two methods, search and update
    // -----
    // Created on Fri Nov 24 2023
    // Created on Wed Nov 29 2023
    //+-------------------------------------------------
    update(item, uuid, force = false) {
      let ref = uuid
      let local = null

      if (!force && index.ed.includes(item.uuid)) return

      // Tries to find the app in the library by IDs
      // If the app is found, update the library, data and store
      // Otherwise, add the app to the data
      //+-------------------------------------------------
      // console.warn('🔎 Searching in Library for', item.name)

      for (const i in library) {
        let lib = library[i]
        // console.warn('Checking', JSON.stringify(lib), 'against', JSON.stringify(item))
        // console.warn(`Is ${lib.name} - ${item.name} ?` , lib.uuid,  item.uuid)

        // tries to find the app by store references
        // This is friendly called 'store dancing'
        // 🤞 Trust coaerced values
        //+-------------------------------------------------
        // this.indexes.forEach((store) => {
        //   if (lib[store + '_id'] && lib[store + '_id'] == item[store + '_id']) {
        //     ref = lib.uuid
        //     console.warn('🔎🔎 Found by', store + '_id', ref)
        //     console.warn(store, lib[store + '_id'], item[store + '_id'])
        //     return
        //   }
        // })

        for (const store of this.indexes) {
          if (lib[store + '_id'] && lib[store + '_id'] == item[store + '_id']) {
            if (lib.is?.ignored) return

            ref = lib.uuid
            console.warn(item.name, '🔎 Found by', store + '_id', ref)
            // console.warn(store, lib[store + '_id'], item[store + '_id'])
            break
          }
        }
      }

      // If the app is not found, just add it to data
      // There is no need to update
      //+-------------------------------------------------
      if (uuid == 'add' && ref == 'add') {
        // console.warn('⬅️ Adding to data and exit: ', item.name)
        let add = { ...item }
        add.api_id = item.uuid

        data[item.uuid] = add
        this.toIndex(add)
        return
      }

      // The local reference is not found
      if (!data[ref] || !ref) return

      console.groupCollapsed()
      console.error('make a cosole.table or console.group')
      console.warn('Processing app (from -> to)')
      console.warn(JSON.stringify(item))
      console.warn(ref)
      console.warn(JSON.stringify(data[ref]))

      //+-------------------------------------------------
      // 🌿 Updating data
      //+-------------------------------------------------

      let toQueue = uuid && uuid.length > 5 ? true : false

      // Determine if the updates should be
      // Added to the queue and saved in $db
      if (!data[ref].api_id && item.api_id) toQueue = true
      if (data[ref].updated_at < item.updated_at) toQueue = true
      if (uuid == 'state') {
        toQueue = true
      }

      local = { ...data[ref], ...item }
      local.uuid = data[ref].uuid

      if (local.api_id !== item.uuid) {
        local.api_id = item.uuid
      }

      console.warn('Result: ', local)
      console.warn('Adding to queue?', toQueue)
      console.groupEnd()
      // Save and index the app
      // Maybe $mitt.emit('data:updated', 'updated', local)
      data[ref] = { ...local }
      library[ref] = { ...local }

      this.toIndex(local)
      if (toQueue) this.toQueue(local)
    },

    //+-------------------------------------------------
    // prepareToStore()
    // to ensureconsistency, add base values to the item
    // and remove unwanted values before returning back
    // -----
    // Created on Thu Dec 14 2023
    //+-------------------------------------------------
    prepareToStore(item, mode) {
      if (!item.uuid) item.uuid = $nuxt.$uuid()
      if (item.is == undefined) item.is = {}

      if (mode !== 'toIgnore') {
        if (item.updated_at == undefined) item.updated_at = 0

        if (item.playtime == undefined) item.playtime = {}
        if (item.last_played == undefined) item.last_played = {}
      }

      if (item.created_at == undefined) item.created_at = dates.now()

      if (item.will_import) delete item.will_import
      if (item.will_update) delete item.will_update
      if (item.will_ignore) delete item.will_ignore

      return item
    },

    //+-------------------------------------------------
    // store()
    // Stores items in games table
    // Adds them to data and indexes
    // -----
    // Created on Fri Dec 22 2023
    //+-------------------------------------------------
    store(items) {
      $nuxt.$db.games.bulkPut(items)
      this.toData(items, 'library')

      log(
        '🎴 User library updated',
        `added ${items.length} apps`,
        items[Math.floor(Math.random() * items.length)]
      )
    },

    //+-------------------------------------------------
    // toIndex()
    // Adds each uuid to their respective store index
    // -----
    // Created on Thu Nov 30 2023
    //+-------------------------------------------------
    toIndex(item, toIndexed = true) {
      if (item.api_id) index.api[item.api_id] = item.uuid
      if (item.igdb_id) index.igdb[item.igdb_id] = item.uuid
      if (item.steam_id) index.steam[item.steam_id] = item.uuid

      if (toIndexed) {
        index.ed.push(item.uuid)
      }

      // index.api[item.api_id] = index.api[item.api_id] || item.uuid
      // index.steam[item.steam_id] = index.steam[item.steam_id] || item.uuid
    },

    //+-------------------------------------------------
    // toData()
    // Adds elements to window.data
    // -----
    // Created on Tue Nov 21 2023
    //+-------------------------------------------------
    async toData(items, source) {
      Object.values(items).forEach((item) => {
        if (source == 'library') {
          data[item.uuid] = item
          this.toIndex(item, false)
        }

        if (source == 'api') {
          this.update(item, 'add')
        }
        // let exists = false

        // this.indexes.forEach((store) => {
        //   if (item[store + '_id']) {
        //     // If there is already an item indexed for that store
        //     // Update the item with new data
        //     // (shouldnt happen often,  only on api calls)
        //     if (index[store][item[store + '_id']]) {
        //       if (item.uuid == index[store][item[store + '_id']]) return

        //       console.warn('Element is already indexed on', store, item)
        //       console.warn(item.uuid, '(API) -> (L)', index[store][item[store + '_id']])
        //       this.update(item, index[store][item[store + '_id']])
        //       exists = true
        //     }
        //   }
        // })

        // if (exists == false) {
        //   data[item.uuid] = item
        // }
      })

      $nuxt.$mitt.emit('data:updated', 'loaded')
    },

    //+-------------------------------------------------
    // toQueue()
    // Thanks copilot
    // -----
    // Created on Wed Nov 29 2023
    //+-------------------------------------------------
    toQueue(app, run = true) {
      if (this.queue.includes(app.uuid)) return

      this.queue.push(app.uuid)

      if (run) this.runQueue()
    },

    async runQueue() {
      // Calls api to get the apps in queue
      if (this.queue.length == 0) return

      setTimeout(async () => {
        console.log('📦 Saving queue', this.queue.length)

        let toSave = []
        this.queue.forEach((uuid) => {
          toSave.push(data[uuid])
        })

        if (this.queue.length < 4) console.log('📦 Queue', toSave)

        await $nuxt.$db.games.bulkPut(toSave)
        $nuxt.$toast.success('Saved queue of ' + this.queue.length, {
          // description: 'Monday, January 3rd at 6:00pm',
        })

        this.queue = []
      }, 5000)
    },

    async updateStale() {
      console.warn('WIP')
      return

      // timeout 5 minutos
    },

    //+-------------------------------------------------
    // updateMissing()
    // Search for apps without api_id and call the api
    // to get the data and update the $db
    // -----
    // Created on Sat Nov 25 2023
    //+-------------------------------------------------
    async updateMissing() {
      console.warn('WIP')
      return
      let missing = {}
      let items = await $nuxt.$db.games
        .filter((game) => game.api_id === undefined)
        .toArray()

      items.forEach((item) => {
        this.indexes.forEach((store) => {
          if (item[store + '_id']) {
            if (missing[store] === undefined) missing[store] = []
            missing[store].push(item[store + '_id'])
          }
        })
      })

      if (Object.keys(missing).length > 0) {
        const jxr = await $nuxt.$axios.post(`get/batch`, missing)
        if (jxr.status) return jxr.data.forEach((item) => this.update(item))
      }
    },

    // //+-------------------------------------------------
    // // loadStates()
    // // Loads the states from the database into memory
    // // NOTE: Might be moved to stateStore
    // // -----
    // // Created on Mon Nov 27 2023
    // //+-------------------------------------------------
    // async loadStates() {
    //   if (this.loaded.includes('states')) return

    //   states = await $nuxt.$db.states.toArray()

    //   this.loaded.push('states')

    //   log(
    //     '❇️ User states are ready',
    //     `found ${states.length} states`,
    //     states[Math.floor(Math.random() * states.length)]
    //   )
    // },

    //+-------------------------------------------------
    // loadLibrary()
    // Loads the entire library of indexedDB into memory
    // Should be called again after an import process
    // -----
    // Created on Fri Nov 17 2023
    //+-------------------------------------------------
    async loadLibrary() {
      if (this.loaded.includes('library')) return

      let query = await $nuxt.$db.games.toArray()
      library = query.reduce((result, game) => {
        result[game.uuid] = game
        return result
      }, {})

      this.toData(library, 'library')
      this.loaded.push('library')

      log(
        '🎴 Library is ready',
        `found ${query.length} apps in library`,
        query[Math.floor(Math.random() * query.length)]
      )
    },

    //+-------------------------------------------------
    // loadApiStatus()
    // Just load some status from API
    // NOTE: Might be moved to apiStore
    // -----
    // Created on Fri Dec 22 2023
    //+-------------------------------------------------
    async loadApiStatus() {
      if (this.loaded.includes('api')) return

      const jxr = await $nuxt.$axios.get(`get/status.json`)
      if (jxr.status) {
        $nuxt.$app.api = jxr.data
        this.api = jxr.data
        this.loaded.push('api')
      }
    },

    //+-------------------------------------------------
    // init()
    // Initialize the data store
    // -----
    // Created on Wed Nov 29 2023
    //+-------------------------------------------------
    async init() {
      if (this.loaded.includes('init')) return
      if (!$nuxt) $nuxt = useNuxtApp()

      this.loaded.push('init')
      this.indexes = Object.keys(index)

      // Load and index data
      // await this.loadStates()
      await this.loadLibrary()
      // await this.updateStale()
      // await this.updateMissing()

      // Expose data to the window
      window.db = {
        d: data,
        o: {
          index,
          library,
          wishlist,
          // states,
          repos,
          search,
        },

        // Functions
        api: this.search,
        status: this.status,
      }

      // Finally, data is ready
      this.isReady = true
      $nuxt.$mitt.emit('data:ready')

      log('💽 Data is ready to use', {
        data: Object.keys(data).length,
        library: Object.keys(library).length,
      })
    },
  },
})

// HMREnabled
// https://pinia.vuejs.org/cookbook/hot-module-replacement.html
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDataStore, import.meta.hot))
}
