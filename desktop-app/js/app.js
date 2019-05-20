const opn = require('opn');
class App{
    constructor(){
        M.AutoInit();
        this.db_root = "https://raw.githubusercontent.com/shaneharris/OpenStoreVR/master/db/";
        this.current_data = [];
        this.setupMenu();
        this.openScreen("games");
        this.setup = new Setup(this);
    }
    setupMenu(){
        this.filter_select = document.querySelector('#filterDropdown');
        this.filter_select.addEventListener('change',()=>this.searchFilter());

        this.search_box = document.querySelector('#searchBox');
        this.search_box.addEventListener('keyup',()=>this.searchFilter());

        this.container = document.querySelector('#container');
        this.setupInstructions = document.querySelector('#setupInstructions');
        this.template = document.querySelector('#listItem');
        this.title = document.querySelector('.header-title');
        this.searchFilterContainer = document.querySelector('#searchFilterContainer');

        [].slice.call(document.querySelectorAll('.menu')).forEach(menu=>{
            menu.addEventListener('click',()=>this.openScreen(menu.dataset.type));
        });
        this.setup_menu = document.querySelector('.setup-menu');
        this.setup_menu.addEventListener('click',()=>this.openSetupScreen());

        this.enable_wifi = document.querySelector('#enable-wifi');
        this.enable_wifi.addEventListener('click',()=>this.setup.enableWifiMode());
        document.getElementById('close-app').addEventListener('click',()=>{
            require('electron').remote.getCurrentWindow().close();
        });
    }
    openExternalLink(url){
        opn(url);
    }
    openSetupScreen(){
        this.container.innerHTML = '';
        this.searchFilterContainer.style.display = 'none';
        this.title.innerHTML = "Setup Instructions";

        let child = this.setupInstructions.content.cloneNode(true);
        this.container.appendChild(child);
        [].slice.call(document.querySelectorAll('.link')).forEach(link=>{
            link.addEventListener('click',()=>this.openExternalLink(link.dataset.url));
        });

        this.install_launcher = document.querySelector('.install-launcher');
        this.install_launcher_loader = document.querySelector('.install-launcher-loading');
        this.install_launcher_container = document.querySelector('.install-launcher-container');
        this.install_launcher.addEventListener('click',()=>{
            this.install_launcher.style.display = 'none';
            this.install_launcher_loader.style.display = 'block';
            this.setup.installApk('https://cdn.theexpanse.app/OpenAppStoreWrapper.apk')
                .then(()=>this.setup.installApk('https://cdn.theexpanse.app/OpenAppStoreLauncher.apk'))
                .then(()=>{
                    this.install_launcher_container.innerHTML = 'Done!';
                })
        });
        this.install_expanse = document.querySelector('.install-expanse');
        this.install_expanse_loader = document.querySelector('.install-expanse-loading');
        this.install_expanse_container = document.querySelector('.install-expanse-container');
        this.install_expanse.addEventListener('click',()=>{
            this.install_expanse.style.display = 'none';
            this.install_expanse_loader.style.display = 'block';
            this.setup.installApk('https://cdn.theexpanse.app/TheExpanse.GearVR.apk').then(()=>{
                this.install_expanse_container.innerHTML = 'Done!';
            })
        });
    }
    openScreen(type){
        this.searchFilterContainer.style.display = 'block';
        this.title.innerHTML = type.charAt(0).toUpperCase() + type.slice(1);
        this.getItems(this.db_root+type+".json","","");
    }
    searchFilter(){
        this.container.innerHTML = '';
        this.current_data.filter(d=>{
            let filter_value = this.filter_select.options[this.filter_select.selectedIndex].value;
            let search_value = this.search_box.value;
            let is_filter = (filter_value === d.category || filter_value === "All");
            return (is_filter && !search_value) ||
                (is_filter &&
                    (~d.name.toLowerCase().indexOf(search_value.toLowerCase()) ||
                        ~d.description.toLowerCase().indexOf(search_value.toLowerCase())));
        }).forEach(d=>{
            let child = this.template.content.cloneNode(true);
            child.querySelector('.image').style.backgroundImage = 'url('+d.image+')';
            child.querySelector('.image').style.backgroundColor = randomColor({seed:d.apk});
            child.querySelector('.card-title-one').innerHTML = '<i class="material-icons right">more_vert</i>'+d.name;
            child.querySelector('.card-title-two').innerHTML = '<i class="material-icons right">close</i>'+d.name;
            child.querySelector('.description').innerText = d.description;
            let installApk = child.querySelector('.install-apk');
            let loading = child.querySelector('.loading');
            if(!this.setup.deviceStatus || this.setup.deviceStatus !== 'connected'){
                installApk.style.display = 'none';
            }
            if(~this.setup.devicePackages.indexOf(d.package)){
                installApk.innerText = 'UNINSTALL';
                installApk.className = 'waves-effect waves-light btn install-apk red';
                installApk.addEventListener('click',()=>{
                    installApk.style.display = 'none';
                    loading.style.display = 'inline-block';
                    this.setup.uninstallApk(d.package).then(()=>{
                        this.setup.getPackages()
                    });
                });
            }else{
                installApk.innerText = 'INSTALL';
                installApk.className = 'waves-effect waves-light btn install-apk';
                installApk.addEventListener('click',()=>{
                    installApk.style.display = 'none';
                    loading.style.display = 'inline-block';
                    this.setup.installApk(d.apk).then(()=>{
                        this.setup.getPackages()
                    });
                });
            }
            this.container.appendChild(child);
        });
    }
    getItems(db){
        fetch(db)
            .then(res=>res.json())
            .then(json=>{
                this.current_data = json;
                this.searchFilter();
            })
    }
}
new App();