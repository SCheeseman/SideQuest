
class App{
    constructor(){
        M.AutoInit();
        this.db_root = "https://raw.githubusercontent.com/shaneharris/OpenStoreVR/master/db/";
        this.current_data = [];
        this.setupMenu();
        this.openScreen("games");
    }
    setupMenu(){
        this.filter_select = document.querySelector('#filterDropdown');
        this.filter_select.addEventListener('change',()=>this.searchFilter());

        this.search_box = document.querySelector('#searchBox');
        this.search_box.addEventListener('keyup',()=>this.searchFilter());

        this.container = document.querySelector('#container');
        this.template = document.querySelector('#listItem');

        [].slice.call(document.querySelectorAll('.menu')).forEach(menu=>{
            menu.addEventListener('click',()=>this.openScreen(menu.dataset.type));
        });
    }
    openScreen(type){
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
            child.querySelector('.card-title-one').innerHTML = d.name+'<i class="material-icons right">more_vert</i>';
            child.querySelector('.card-title-two').innerHTML = d.name+'<i class="material-icons right">close</i>';
            child.querySelector('.description').innerText = d.description;
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