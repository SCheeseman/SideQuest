const opn = require('opn');
const remote = require('electron').remote;
const eApp = require('electron').remote.app;
const adb = require('adbkit');
const extract = require('extract-zip');
const os = require('os');
const fs = require('fs');
const path = require('path');
const request = require('request');
const md5 = require('md5');
const Readable = require('stream').Readable;
const appData = path.join(eApp.getPath('appData'),'OpenStoreVR');
const semver = require('semver');
class App{
    constructor(){
        M.AutoInit();
        fs.mkdir(appData,()=>{
            fs.mkdir(path.join(appData,'sources'),()=>{
                this.current_data = [];
                this.setupMenu();
                this.setup = new Setup(this);
                this.repos = new Repos(this);
            });
        });
    }
    setupMenu(){
        this.spinner_drag = document.querySelector('.spinner-drag');
        this.spinner_background = document.querySelector('.spinner-background');
        this.add_repo = document.querySelector('.add-repo');
        this.add_repo_button = document.querySelector('.add-repo-button');
        this.add_repo_url = document.querySelector('#repoUrl');
        this.menu_container = document.querySelector('.menu-items');
        this.filter_select = document.querySelector('#filterDropdown');
        this.filter_select.addEventListener('change',()=>this.searchFilter());
        this.spinner_loading_message = document.querySelector('.spinner-loading-message');

        this.search_box = document.querySelector('#searchBox');
        this.search_box.addEventListener('keyup',()=>this.searchFilter());

        this.container = document.querySelector('#container');

        this.setupInstructions = document.querySelector('#setupInstructions');
        this.appItem = document.querySelector('#appItem');
        this.template = document.querySelector('#listItem');
        this.appVersion = document.querySelector('#appVersion');

        this.title = document.querySelector('.header-title');
        this.searchFilterContainer = document.querySelector('#searchFilterContainer');

        [].slice.call(document.querySelectorAll('.menu')).forEach(menu=>{
            menu.addEventListener('click',()=>this.openScreen(menu.dataset.type));
        });
        this.setup_menu = document.querySelector('.setup-menu');
        this.setup_menu.addEventListener('click',()=>this.openSetupScreen());

        this.add_menu = document.querySelector('.add-menu');
        this.add_menu.addEventListener('click',()=>this.repos.openRepos());

        this.enable_wifi = document.querySelector('#enable-wifi');
        this.enable_wifi.addEventListener('click',()=>this.setup.enableWifiMode());
        document.getElementById('close-app').addEventListener('click',()=>{
            remote.getCurrentWindow().close();
        });
        document.getElementById('open-debugger').addEventListener('click',()=>{
            remote.getCurrentWindow().toggleDevTools();
        });
        document.addEventListener('DOMContentLoaded', function() {
            let elems = document.querySelectorAll('.modal');
            M.Modal.init(elems, {});
        });
        let dragTimeout;
        document.ondragover = () => {
            clearTimeout(dragTimeout);
            this.spinner_drag.style.display = 'block';
            this.spinner_background.style.display = 'block';
            return false;
        };

        document.ondragleave = () => {
            dragTimeout = setTimeout(()=>{
                this.spinner_drag.style.display = 'none';
                this.spinner_background.style.display = 'none';
            },1000)
            return false;
        };

        document.ondragend = () => {
            this.spinner_drag.style.display = 'none';
            this.spinner_background.style.display = 'none';
            return false;
        };

        document.ondrop = (e) => {
            e.preventDefault();
            this.spinner_drag.style.display = 'none';
            this.spinner_background.style.display = 'none';
            for (let f of e.dataTransfer.files) {
                this.spinner_loading_message.innerText = 'Installing APK, Please wait...';
                this.toggleLoader(true);
                this.setup.installLocalApk(f.path)
                    .then(()=>this.toggleLoader(false));
            }
            return false;
        };
    }
    toggleLoader(show){
        document.querySelector('.spinner').style.display =
        this.spinner_background.style.display = show ? 'block' : 'none';
    }
    openExternalLink(url){
        opn(url);
    }
    getAppSummary(app){
        if(app.summary||app.description){
            return (app.summary||'')
                +(app.summary&&app.description?'<br><br>':'')
                +(app.description||'');
        }else if(app.localized){

            const firstKey = app.localized['en-US']?'en-US':Object.keys(app.localized)[0];
            if(firstKey){
                return (app.localized[firstKey].summary||"")
                    +(app.localized[firstKey].summary&&app.localized[firstKey].description?'<br><br>':'')
                    +(app.localized[firstKey].description||"")
            }else{
                return 'No description...';
            }
        }else {
            return 'No description...';
        }

    }
    getLongMetaData(app){
        let output = '';
        let properties = [
            'packageName',
            'authorEmail',
            'webSite',
            'sourceCode',
            'issueTracker',
            'changelog'
        ];
        let webProperties = properties.filter(p=>p!=='packageName'&&p!=='authorEmail');
        properties.forEach(p=>{
            if(app[p]){
                if(~webProperties.indexOf(p)){
                    output += p+": <span class=\"link\" data-url=\""+app[p]+"\">"+app[p]+"</span><br>";
                }else{
                    output += p+": <b>"+app[p]+"</b><br>";
                }
            }
        });
        return output;
    }
    getAppMetadata(app){
        let output = '';
        let dateProperties = [
            'added',
            'lastUpdated'
        ];
        let properties = [
            'authorName',
            'license'
        ];
        dateProperties.forEach(p=>{
            if(app[p]){
                output += p+": <b>"+(new Date(app[p]).toDateString())+"</b><br>";
            }
        });
        properties.forEach(p=>{
            if(app[p]){
                output += p+": <b>"+app[p]+"</b><br>";
            }
        });
        return output;
    }
    async showInstalledPackage(child, app,appPackage){
        child.querySelector('.app-meta').innerHTML = this.getAppMetadata(app);
        if(~this.setup.devicePackages.indexOf(app.packageName)){
            let installedVersion = await this.setup.getPackageInfo(app.packageName)
            let hasUpdate = false;
            appPackage.forEach(p=>{
                try{
                    if(semver.lt(installedVersion, p.versionName)){
                        hasUpdate = true;
                    }
                }catch(e){}
            });
            child.querySelector('.app-meta').innerHTML += '<br>'+(hasUpdate?'Update Available<br>':'')+'Installed version: '+installedVersion+'<br>';
        }
    }
    async openAppScreen(app,appPackage){
        //console.log(app,appPackage);
        this.add_repo.style.display = 'none';
        this.container.innerHTML = '';
        this.searchFilterContainer.style.display = 'none';
        this.title.innerHTML = app.name;
        let child = this.appItem.content.cloneNode(true);
        child.querySelector('.app-image').src = app.icon;
        child.querySelector('.summary').innerHTML = this.getAppSummary(app)+'<br><br>'+this.getLongMetaData(app)+'<br><br>';
        child.querySelector('.screenshots');

        [].slice.call(child.querySelectorAll('.link')).forEach(link=>{
            link.addEventListener('click',()=>this.openExternalLink(link.dataset.url));
        });
        try{
            appPackage.sort((a,b)=>semver.rcompare(a.versionName,b.versionName));
        }catch(e){}
        await this.showInstalledPackage(child, app,appPackage);
        appPackage.forEach((p,i)=>{
            let versionChild = this.appVersion.content.cloneNode(true);
            if(i===0){
                versionChild.querySelector('li').className = 'active';
            }
            versionChild.querySelector('.version-name').innerText = 'V. '+p.versionName;
            versionChild.querySelector('.install-apk').addEventListener('click',()=>{
                this.toggleLoader(true);
                this.spinner_loading_message.innerText = 'Installing APK...';
                this.setup.installApk(p.apkName.substr(0,7)==='http://'||p.apkName.substr(0,8)==='https://'?p.apkName:this.current_data.url+p.apkName)
                    .then(()=>{
                        this.toggleLoader(false);
                        return this.showInstalledPackage(this.container, app,appPackage);
                    });
            });
            versionChild.querySelector('.permissions').innerHTML = (p['uses-permission']||[]).map(permission=>{
                return typeof permission === 'string'? permission: permission.filter(p=>p).join('<br>');
            }).join('<br>');
            child.querySelector('.app-versions').appendChild(versionChild);
        });
        this.container.appendChild(child);
        this.setup.getPackageInfo(app.packageName);
       M.Collapsible.init(document.querySelectorAll('.collapsible'), {});
    }
    openSetupScreen(){
        this.add_repo.style.display = 'none';
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
        if(~this.setup.devicePackages.indexOf('com.openappstore.wrapper') && ~this.setup.devicePackages.indexOf('com.openappstore.launcher')) {
            this.install_launcher_container.innerHTML = 'Already Installed!';
        }else {
            this.install_launcher.addEventListener('click', () => {
                this.install_launcher.style.display = 'none';
                this.install_launcher_loader.style.display = 'inline-block';
                this.setup.installApk('https://cdn.theexpanse.app/OpenAppStoreWrapper.apk')
                    .then(() => this.setup.installApk('https://cdn.theexpanse.app/OpenAppStoreLauncher.apk'))
                    .then(() => {
                        this.install_launcher_container.innerHTML = 'Done!';
                    })
            });
        }
        this.install_expanse = document.querySelector('.install-expanse');
        this.install_expanse_loader = document.querySelector('.install-expanse-loading');
        this.install_expanse_container = document.querySelector('.install-expanse-container');
        if(~this.setup.devicePackages.indexOf('app.theexpanse.app')) {
            this.install_expanse_container.innerHTML = 'Already Installed!';
        }else{
            this.install_expanse.addEventListener('click',()=>{
                this.install_expanse.style.display = 'none';
                this.install_expanse_loader.style.display = 'inline-block';
                this.setup.installApk('https://cdn.theexpanse.app/TheExpanse.GearVR.apk').then(()=>{
                    this.install_expanse_container.innerHTML = 'Done!';
                })
            });
        }
    }
    openScreen(type){
        this.add_repo.style.display = 'none';
        this.container.innerHTML = '<h4 class="grey-text">Loading apps...</h4>';
        this.searchFilterContainer.style.display = 'block';
        this.title.innerHTML = type.charAt(0).toUpperCase() + type.slice(1);
        this.getItems(this.db_root+type+".json","","");
    }
    searchFilter(){
        this.container.innerHTML = '';
        this.current_data.body.apps.filter(d=>{
            let filter_value = this.filter_select.options[this.filter_select.selectedIndex].value;
            let search_value = this.search_box.value;
            let is_filter = (filter_value === d.category || filter_value === "All");
            return (is_filter && !search_value) ||
                (is_filter &&
                    (~d.name.toLowerCase().indexOf(search_value.toLowerCase()) ||
                        ~(d.summary||'').toLowerCase().indexOf(search_value.toLowerCase())));
        }).forEach(d=>{
            let child = this.template.content.cloneNode(true);
            child.querySelector('.image').style.backgroundImage = 'url('+d.icon+')';
            child.querySelector('.image').style.backgroundColor = randomColor({seed:d.packageName});
            child.querySelector('.card-title-one').innerHTML = '<i class="material-icons right">more_vert</i>'+d.name;
            child.querySelector('.card-title-two').innerHTML = '<i class="material-icons right">close</i>'+d.name;
            child.querySelector('.description').innerText = (d.summary||'');
            let installApk = child.querySelector('.install-apk');
            let loading = child.querySelector('.loading');
            if(!this.setup.deviceStatus || this.setup.deviceStatus !== 'connected'){
                installApk.style.display = 'none';
            }
            installApk.innerText = 'More';
            installApk.className = 'waves-effect waves-light btn install-apk';
            installApk.addEventListener('click',()=>{
                this.openAppScreen(d,this.current_data.body.packages[d.packageName]);
            });
            // if(~this.setup.devicePackages.indexOf(d.packageName)){
            //     installApk.innerText = 'UNINSTALL';
            //     installApk.className = 'waves-effect waves-light btn install-apk red';
            //     installApk.addEventListener('click',()=>{
            //         installApk.style.display = 'none';
            //         loading.style.display = 'inline-block';
            //         this.setup.uninstallApk(d.packageName).then(()=>{
            //             this.setup.getPackages()
            //         });
            //     });
            // }else{
            //     installApk.innerText = 'INSTALL';
            //     installApk.className = 'waves-effect waves-light btn install-apk';
            //     installApk.addEventListener('click',()=>{
            //         this.openAppScreen(d,this.current_data.body.packages[d.packageName]);
            //     });
            // }
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